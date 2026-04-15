import express from 'express';
import expressWs from 'express-ws';
import { spawn } from 'node-pty';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, sep } from 'path';
import { readdirSync } from 'fs';
import { homedir } from 'os';
import dotenv from 'dotenv';
import { getCurrentContext, getDailyUsage } from './lib/usage.js';
import * as knownSessions from './lib/known-sessions.js';
import { discoverProjects, listProjects, getProject, patchProject, createProject, releaseProject, searchItems, loadRegistry } from './lib/projects.js';
import * as projectWatcher from './lib/project-watcher.js';
import * as attention from './lib/attention.js';
import { loadVapid } from './lib/vapid.js';
import * as pushSubs from './lib/push-subscriptions.js';
import webpush from 'web-push';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3333;
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const SESSION_PREFIX = process.env.SESSION_PREFIX || 'cc-';
const TMUX = process.env.TMUX_PATH || '/opt/homebrew/bin/tmux';

// LaunchAgent startet uns mit minimalem PATH (/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin).
// `claude` liegt in ~/.local/bin und wäre sonst für tmux-Child-Prozesse unauffindbar →
// neu erstellte Sessions würden sofort mit Exit 127 sterben.
const EXTRA_PATHS = [join(homedir(), '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin'];
process.env.PATH = [...new Set([...EXTRA_PATHS, ...(process.env.PATH || '').split(':')])].filter(Boolean).join(':');

// Mouse-Mode global in tmux aktivieren, sodass Wheel-Events im xterm.js-Client
// als Scroll-Back funktionieren. Ohne das sieht der attached Client keine
// Scroll-Events und die Terminal-View scheint eingefroren, sobald Output länger
// als die Pane-Höhe wird. Race-Condition: Server startet evtl. bevor tmux läuft
// → Aufruf scheitert still. Deshalb auch nach jeder Session-Erstellung gerufen.
function ensureMouseOn() {
  try {
    execFileSync(TMUX, ['set-option', '-g', 'mouse', 'on'], {
      encoding: 'utf-8', timeout: 2000, stdio: 'pipe',
    });
  } catch { /* tmux-Server noch nicht da */ }
}
ensureMouseOn();

const app = express();
expressWs(app, null, {
  // C3: Token-Auth für WebSocket per Sec-WebSocket-Protocol. Client sendet
  // ['bearer.<token>']; wir echo'n den Protokoll-String zurück, ansonsten
  // schließen manche Browser die Verbindung. Das eigentliche Matching passiert
  // unten im Route-Handler.
  wsOptions: {
    handleProtocols: (protocols /* Set<string> in ws v8 */) => {
      for (const p of protocols) {
        if (typeof p === 'string' && p.startsWith('bearer.')) return p;
      }
      return false;
    },
  },
});

// express.json() für alles außer /api/hooks — Claude liefert dort
// gelegentlich syntaktisch kaputtes JSON und der Parser würde mit 400
// abbrechen, bevor unser Handler läuft. Hook-Route hat ihren eigenen
// Raw-Body-Parser mit try/catch.
const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.path.startsWith('/api/hooks/')) return next();
  return jsonParser(req, res, next);
});

// Security-Header. CSP ist bewusst mit `'unsafe-inline'` für script/style,
// weil das Frontend eine Single-File-SPA mit inline-JS/CSS ist — Hashes
// oder Nonces wären aufwendig zu pflegen ohne Build-Step. Externe Ressourcen
// sind strikt auf die bekannten CDNs begrenzt, damit XSS-Folgeschäden
// (externe Script-Injection, Daten-Exfil) gedeckelt sind. `connect-src`
// erlaubt ws/wss zum eigenen Host für den Terminal-WebSocket.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' ws: wss: https:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Healthcheck für Cloudflare-Tunnel-Monitoring und zukünftige Uptime-Checks.
// Bewusst außerhalb von `/api` und vor dem auth-middleware registriert, damit
// er ohne Token erreichbar ist. Liefert aktuellen Zustand als JSON plus
// Basis-Metriken, die als Startpunkt für das spätere Metrics-Feature dienen.
const START_TIME = Date.now();
app.get('/healthz', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    sessions: getTmuxSessions().length,
    activePtys: activePtys.size,
    version: process.env.npm_package_version || null,
  });
});

// Request-Logger: nur HTTP, keine WS (die kommen über upgrade und matchen
// diesen Middleware nicht). Pfad ohne Query, damit der ?token= Fallback
// nicht in den Logs landet. /healthz wird übersprungen, damit Monitoring-
// Polls die Logs nicht fluten.
app.use((req, _res, next) => {
  const path = req.url.split('?')[0];
  if (path !== '/healthz') {
    console.log(`${new Date().toISOString()} ${req.method} ${path}`);
  }
  next();
});

// Service Worker: dedizierte Route damit der `Service-Worker-Allowed`-Header
// gesetzt wird. Ohne diesen Header darf der SW nur den Sub-Pfad von seiner
// URL kontrollieren (/sw.js wäre leer) — mit '/' kontrolliert er den ganzen Hub.
app.get('/sw.js', (_req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(join(__dirname, 'public', 'sw.js'));
});

app.use(express.static(join(__dirname, 'public')));

// ── Auth middleware ──────────────────────────────────────────────────────────
// Akzeptiert drei Quellen:
//   1. `Authorization: Bearer <token>` (Standard-REST)
//   2. `?token=<token>` Query-Param (Fallback, vor allem Legacy)
//   3. `Sec-WebSocket-Protocol: bearer.<token>` (WebSocket-Upgrade — Browser
//      erlauben bei `new WebSocket(url, protocols)` keinen Authorization-
//      Header, also müssen wir den Token als Subprotocol übergeben)
function extractToken(req) {
  const header = req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  if (header) return header;
  if (req.query.token) return req.query.token;
  const proto = req.headers['sec-websocket-protocol'];
  if (proto) {
    const sub = proto.split(',').map(s => s.trim()).find(p => p.startsWith('bearer.'));
    if (sub) return sub.slice(7);
  }
  return null;
}
function authMiddleware(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const token = extractToken(req);
  if (token === AUTH_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
// VAPID-Public-Key ist öffentlich — kein Auth. Browser brauchen ihn vor dem
// pushManager.subscribe() Call, also vor jeglicher Token-Interaktion.
app.get('/api/push/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || '';
  if (!key) return res.status(503).json({ error: 'VAPID not configured' });
  res.json({ publicKey: key });
});

app.use('/api', authMiddleware);

// ── Validation ───────────────────────────────────────────────────────────────
// Erlaubte Zeichen im Session-Namen: Buchstaben, Zahlen, _, -, ., Leerzeichen.
// Explizit verboten: Quotes, Backslash, Shell-Metachars, Control-Chars.
const SESSION_NAME_RE = /^[\w\-. ]{1,64}$/;
const validSessionName = (n) => typeof n === 'string' && SESSION_NAME_RE.test(n);

// Browse auf den Home-Ordner eingrenzen — verhindert `?path=/etc/passwd`.
const HOME = homedir();
function isUnderHome(p) {
  const r = resolve(p);
  return r === HOME || r.startsWith(HOME + sep);
}

// ── Helper: tmux list-sessions ───────────────────────────────────────────────
function getTmuxSessions() {
  try {
    const output = execFileSync(TMUX, [
      'list-sessions',
      '-F', '#{session_name}|#{session_created}|#{session_windows}|#{session_attached}|#{pane_current_path}',
    ], { encoding: 'utf-8', timeout: 5000 }).trim();
    if (!output) return [];
    return output.split('\n').map(line => {
      const [name, created, windows, attached, path] = line.split('|');
      return {
        name,
        created: parseInt(created) * 1000,
        windows: parseInt(windows),
        attached: parseInt(attached) > 0,
        path: path || '~',
      };
    });
  } catch {
    return [];
  }
}

// ── Helper: pane preview mit kleinem TTL-Cache ───────────────────────────────
// Ohne Cache macht jedes Dashboard-Polling N+1 execFile-Calls. Bei 5 s Polling
// und mehreren Sessions summiert sich das schnell. 2 s Cache ist ein sinnvoller
// Tradeoff zwischen Frische und Load.
const previewCache = new Map();
const PREVIEW_TTL_MS = 2000;

function getSessionPreview(sessionName, lines = 8) {
  // Cache-Key inkludiert `lines`, sonst würden Calls mit verschiedenen
  // Buffer-Größen (Hash-Vergleich vs Card-Preview) sich gegenseitig
  // überschreiben — oder schlimmer: eine kleinere Anfrage bekommt die
  // größere zurück und vice versa.
  const key = `${sessionName}|${lines}`;
  const cached = previewCache.get(key);
  if (cached && Date.now() - cached.ts < PREVIEW_TTL_MS) return cached.value;
  try {
    const output = execFileSync(TMUX, [
      'capture-pane', '-t', sessionName, '-p', '-S', `-${lines}`,
    ], { encoding: 'utf-8', timeout: 3000 }).trim();
    previewCache.set(key, { value: output, ts: Date.now() });
    return output;
  } catch {
    return '';
  }
}

function invalidatePreview(name) {
  // Alle Cache-Einträge für diese Session (egal welche line-Count) entfernen.
  for (const key of Array.from(previewCache.keys())) {
    if (key === name || key.startsWith(name + '|')) previewCache.delete(key);
  }
}

// ── Usage-Limit-Parsing ──────────────────────────────────────────────────────
// Extrahiert den 5h-Nutzungsanteil aus der Claude Code Status-Line.
// Format in der letzten Terminalzeile: "5h ####- 77%"
// Gibt null zurück wenn das Pattern nicht gefunden wird (Session ohne Claude
// oder Pane noch nicht sichtbar).
function parseUsagePct5h(preview) {
  if (!preview) return null;
  const m = /5h\s+[#\-]+\s+(\d+)%/.exec(preview);
  return m ? parseInt(m[1], 10) : null;
}

// ── Hub-Env für Claude-Hooks ─────────────────────────────────────────────────
// Injiziert beim tmux new-session Variablen, damit der Claude-Hook (in
// ~/.claude/settings.json) per curl an /api/hooks/:event POSTen kann.
// Fehlende Werte werden weggelassen — der Hook-curl fällt dann auf `|| true`.
// CC_HUB_SESSION wird im Claude-Child-Prozess beim tmux new-session gesetzt
// und bleibt auch nach einem späteren tmux rename-session auf dem Original-
// namen. Diese Map mappt die vom Hook gemeldete Env-ID auf den aktuell in
// tmux sichtbaren Namen — sonst würden Hook-Events ins Leere laufen.
const hookAlias = new Map();
function resolveHookSession(envName) {
  return hookAlias.get(envName) || envName;
}
function aliasOnRename(oldName, newName) {
  // Alle bestehenden Aliase, die auf oldName zeigten, nachziehen.
  for (const [k, v] of hookAlias.entries()) {
    if (v === oldName) hookAlias.set(k, newName);
  }
  // oldName selbst → newName.
  if (oldName !== newName) hookAlias.set(oldName, newName);
}

function hubEnvArgs(sessionName) {
  const args = [
    '-e', `CC_HUB_SESSION=${sessionName}`,
    '-e', `CC_HUB_URL=http://127.0.0.1:${PORT}`,
  ];
  if (AUTH_TOKEN) args.push('-e', `CC_HUB_TOKEN=${AUTH_TOKEN}`);
  return args;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── REST API ────────────────────────────────────────────────────────────────

// List sessions. Preview wird intern für Activity-Detection geholt, aber
// NICHT ans Frontend ausgeliefert — der 8-Zeilen-Preview-Block im UI ist
// entfernt. `?preview=0` behält seine Bedeutung (schaltet auch die
// Activity-Detection ab, weil dafür auch der capture-pane-Call entfällt).
app.get('/api/sessions', (req, res) => {
  const live = getTmuxSessions();
  const withActivity = req.query.preview !== '0';
  const liveByName = new Map(live.map(s => [s.name, s]));
  const known = knownSessions.list();
  const knownByName = new Map(known.map(e => [e.name, e]));

  // 1) running + foreign aus tmux — foreign = läuft in tmux, aber weder
  //    mit cc-Prefix noch in known-sessions eingetragen.
  const running = [];
  const foreign = [];
  for (const s of live) {
    const isKnown = knownByName.has(s.name);
    const isCcPrefixed = s.name.startsWith(SESSION_PREFIX);
    if (isKnown || isCcPrefixed) {
      running.push({ ...s, status: 'running' });
    } else {
      foreign.push({ ...s, status: 'foreign' });
    }
  }

  // 2) dormant = in known-sessions, aber nicht in tmux live.
  //    Kein Preview/Activity — die Pane existiert nicht.
  const dormant = known
    .filter(e => !liveByName.has(e.name))
    .map(e => ({
      name: e.name,
      path: e.directory,
      command: e.command,
      created: e.createdAt ? Date.parse(e.createdAt) : null,
      lastSeenAt: e.lastSeenAt,
      windows: 0,
      attached: false,
      status: 'dormant',
    }));

  // Enrichment: Activity kommt ausschließlich aus dem Hook-State. Preview
  // wird nur noch für parseUsagePct5h gezogen (5h-Quota aus der Status-
  // Line). Sessions ohne frischen Hook zeigen activity:`unknown` → Label
  // "Aktiv" im Dashboard.
  const enrich = (s) => {
    let preview = null;
    if (withActivity && s.status !== 'dormant') {
      preview = getSessionPreview(s.name);
    }
    const hookActivity = attention.getHookActivity(s.name);
    const base = {
      ...s,
      activity: hookActivity || 'unknown',
      usagePct5h: preview !== null ? parseUsagePct5h(preview) : null,
    };
    // attached an den Attention-Engine zurückmelden, damit der nächste
    // Hook-Event weiß, ob der User zuschaut (→ kein session-attention).
    if (s.status !== 'dormant') attention.setAttached(s.name, !!s.attached);
    try {
      const ctx = getCurrentContext(s.path);
      base.contextTokens = ctx.tokens;
      base.contextModel = ctx.model;
      base.contextLimit = ctx.limit;
      base.contextPct = ctx.pct;
    } catch {
      base.contextTokens = null;
      base.contextModel = null;
      base.contextLimit = null;
      base.contextPct = null;
    }
    base.muted = knownSessions.isMuted(s.name);
    return base;
  };

  res.json([
    ...running.map(enrich),
    ...dormant.map(enrich),
    ...foreign.map(enrich),
  ]);
});

// Aggregierte Usage-Historie (Tages-Totals + Monatssumme). 60s-Cache, weil
// die JSONL-Dateien nur minütlich neue Einträge bekommen.
let usageCache = { ts: 0, data: null };
app.get('/api/usage/history', async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
  const key = `days=${days}`;
  const now = Date.now();
  if (usageCache.data && usageCache.key === key && now - usageCache.ts < 60_000) {
    return res.json(usageCache.data);
  }
  try {
    const data = await getDailyUsage({ days });
    usageCache = { ts: now, key, data };
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to compute usage', detail: e.message });
  }
});

// ── Projekt-Verwaltung (Phase 1 Step 2b) ──────────────────────────────
// Quelle: ~/.claude-code-hub/projects.json + ROADMAP.md pro Projekt.
// Registry ist ein Long-Lived-Singleton in lib/projects.js. Writes gehen
// durch mutateRegistry (withFileLock + Clone+Swap), Mutationen an einzelnen
// ROADMAP.md-Dateien durch mutateRoadmap (withFileLock, fresh inside-lock).
//
// Discovery-on-read: GET /api/projects scannt bei Bedarf die konfigurierten
// Roots nach. Throttle via DISCOVERY_TTL_MS, damit Dashboard-Polling
// (alle 5s beim aktiven Tab) nicht jeden Mal die Disk anrasselt.
const DISCOVERY_TTL_MS = 30_000;
let lastDiscoveryAt = 0;
let discoveryInflight = null;
async function maybeRediscover() {
  if (Date.now() - lastDiscoveryAt < DISCOVERY_TTL_MS) return;
  if (discoveryInflight) return discoveryInflight; // dedupe
  discoveryInflight = discoverProjects(projectRoots)
    .then(async (r) => {
      lastDiscoveryAt = Date.now();
      if (r.added > 0) {
        console.log(`[projects] rediscovery: +${r.added}, total=${r.total}`);
        const reg = await loadRegistry();
        projectWatcher.syncWatchers(reg);
      }
      return r;
    })
    .catch(e => console.error('[projects] rediscovery failed:', e.message))
    .finally(() => { discoveryInflight = null; });
  return discoveryInflight;
}

app.get('/api/projects', async (_req, res) => {
  try {
    // Best-effort Re-Scan: Fehler blockieren den Read nicht.
    await maybeRediscover();
    const projects = await listProjects();
    res.json({ projects });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list projects', detail: e.message });
  }
});

// Neues Projekt anlegen: schreibt ROADMAP.md mit Template und registriert.
// Body: { displayName: string, path: string }. Path-Allowlist: unter HOME.
app.post('/api/projects', async (req, res) => {
  const { displayName, path: projectPath } = req.body || {};
  if (typeof projectPath !== 'string' || !projectPath) {
    return res.status(400).json({ error: 'path required' });
  }
  // Pfad-Gate: nur unter $HOME erlauben, konsistent mit /api/browse.
  // Hier bewusst kein `~`-Expand — Frontend liefert absolute Pfade.
  const absPath = resolve(projectPath);
  if (!isUnderHome(absPath)) {
    return res.status(403).json({ error: 'path must be under home directory' });
  }
  try {
    const entry = await createProject({ displayName, path: absPath });
    // Watcher direkt anziehen, damit spätere Edits in diesem Projekt ohne
    // Verzögerung live synchronisiert werden.
    projectWatcher.syncWatchers(await loadRegistry());
    res.status(201).json(entry);
  } catch (e) {
    if (e.code === 'bad-body') {
      return res.status(400).json({ error: 'Bad request', detail: e.detail || e.message });
    }
    if (e.code === 'path-exists' || e.code === 'path-conflict') {
      return res.status(409).json({ error: e.detail || e.message });
    }
    console.error('[projects] create failed:', e);
    res.status(500).json({ error: 'Failed to create project', detail: e.message });
  }
});

// Volltext-Suche über Roadmap-Items aller Projekte. `q` ist case-insensitive,
// Frontend ruft debounced auf. Limit defaultet auf 50.
app.get('/api/projects/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const result = await searchItems(q, { limit });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Search failed', detail: e.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load project', detail: e.message });
  }
});

// Release abschließen: Dev-Items → Released, Versions bumpen, Changelog-
// Eintrag erzeugen. Destruktiv (Dev wird geleert), Frontend confirmt.
app.post('/api/projects/:id/release', async (req, res) => {
  try {
    const fresh = await releaseProject(req.params.id, req.body || {});
    res.json(fresh);
  } catch (e) {
    const code = e.code;
    if (code === 'unknown-id' || code === 'missing-roadmap') {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (code === 'bad-body') {
      return res.status(400).json({ error: 'Bad request', detail: e.detail || e.message });
    }
    if (code === 'section-missing') {
      return res.status(400).json({ error: 'ROADMAP.md structure incomplete', detail: e.detail || e.message });
    }
    if (code === 'section-order') {
      return res.status(400).json({ error: 'Unsupported section order', detail: 'Need Released → In Entwicklung → Changelog' });
    }
    console.error('[projects] release failed:', e);
    res.status(500).json({ error: 'Failed to finalize release', detail: e.message });
  }
});

app.patch('/api/projects/:id/items', async (req, res) => {
  try {
    const fresh = await patchProject(req.params.id, req.body || {});
    res.json(fresh);
  } catch (e) {
    const code = e.code;
    if (code === 'unknown-id' || code === 'missing-roadmap') {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (code === 'stale') {
      return res.status(409).json({ error: 'Stale line offset', detail: 'Line does not contain a checkbox item anymore' });
    }
    if (code === 'section-not-found') {
      // 409 statt 400: die Section ist beim Write-Back verschwunden, während
      // der Client noch die alte Struktur anzeigte — das ist ein Konflikt-
      // Szenario wie `stale`, kein Bad-Request. Der Client triggert dann
      // einen Refresh statt nur einen Error-Toast.
      return res.status(409).json({ error: 'Section not found in ROADMAP.md' });
    }
    if (code === 'bad-action' || code === 'bad-body') {
      return res.status(400).json({ error: 'Bad request', detail: e.detail || e.message });
    }
    console.error('[projects] patch failed:', e);
    res.status(500).json({ error: 'Failed to patch project', detail: e.message });
  }
});

// Browse directories (for tree picker in UI). Path-Allowlist: nur unter Home.
app.get('/api/browse', (req, res) => {
  let p = req.query.path || process.env.DEFAULT_PROJECT_DIR || '~';
  if (p === '~' || p.startsWith('~/')) p = join(HOME, p.slice(1));
  p = resolve(p);
  if (!isUnderHome(p)) {
    return res.status(403).json({ error: 'Access denied: path outside home directory', path: p });
  }
  const showHidden = req.query.hidden === '1';
  try {
    const entries = readdirSync(p, { withFileTypes: true })
      .filter(e => e.isDirectory() && (showHidden || !e.name.startsWith('.')))
      .map(e => ({ name: e.name, path: join(p, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    res.json({ path: p, home: HOME, entries });
  } catch (err) {
    res.status(400).json({ error: err.message, path: p });
  }
});

// Create new session. Session-Name muss Validator bestehen. tmux wird als
// argv aufgerufen, kein Shell-Parsing → keine Quote-Injection möglich.
app.post('/api/sessions', async (req, res) => {
  const { name, directory, command } = req.body;
  if (!validSessionName(name)) {
    return res.status(400).json({
      error: 'Invalid session name: only letters, digits, dash, dot, underscore, spaces; 1-64 chars',
    });
  }
  const sessionName = SESSION_PREFIX + name;
  const dir = directory || process.env.DEFAULT_PROJECT_DIR || HOME;
  const cmd = command || 'claude';

  if (getTmuxSessions().some(s => s.name === sessionName)) {
    return res.status(409).json({ error: 'Session with this name already exists' });
  }

  try {
    // tmux nimmt den Command als einzelnes letztes argv und reicht es per
    // `/bin/sh -c` weiter — dadurch funktionieren Commands mit Spaces wie
    // `claude --dangerously-skip-permissions` ohne dass wir selbst eine
    // Shell anwerfen.
    execFileSync(TMUX, ['new-session', '-d', '-s', sessionName, ...hubEnvArgs(sessionName), '-c', dir, cmd], {
      encoding: 'utf-8', timeout: 5000,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  // Poll statt setTimeout(500): schnell wenn die Session sofort da ist,
  // geduldig wenn der Kern-Boot mal länger braucht.
  for (let i = 0; i < 20; i++) {
    await sleep(40);
    const created = getTmuxSessions().find(s => s.name === sessionName);
    if (created) {
      // Erst nach bestätigtem Session-Start persistieren — sonst stünden
      // Einträge für tot-geborene Sessions in der JSON (Exit-127-Fälle aus
      // der Error-Message unten). Fehler beim Write sollen den 201 nicht
      // blockieren: der User hat eine lebende Session, Recovery-Tracking
      // ist ein Bonus.
      try {
        await knownSessions.add({ name: sessionName, directory: dir, command: cmd });
      } catch (e) {
        console.error('[known-sessions] add failed:', e);
      }
      // Mouse-Mode sicherstellen: falls beim Server-Start tmux noch nicht
      // lief, konnte ensureMouseOn() nicht greifen — jetzt läuft tmux sicher.
      ensureMouseOn();
      return res.status(201).json({ ...created, preview: getSessionPreview(sessionName) });
    }
  }
  res.status(500).json({
    error: `Session "${sessionName}" wurde gestartet, aber sofort wieder beendet. Wahrscheinlich ist "${cmd}" nicht im PATH oder das Kommando beendet sich direkt.`,
  });
});

// Kill session
app.delete('/api/sessions/:name', (req, res) => {
  const { name } = req.params;
  if (!SESSION_NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Invalid session name' });
  }
  try {
    execFileSync(TMUX, ['kill-session', '-t', name], { encoding: 'utf-8', timeout: 5000 });
    invalidatePreview(name);
    attention.forget(name);
    // Alias-Einträge aufräumen, die auf diese Session zeigten.
    for (const [k, v] of hookAlias.entries()) {
      if (v === name || k === name) hookAlias.delete(k);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename session
app.patch('/api/sessions/:name', async (req, res) => {
  const { name } = req.params;
  const { newName } = req.body;
  if (!SESSION_NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Invalid source session name' });
  }
  if (typeof newName !== 'string' || !SESSION_NAME_RE.test(newName.replace(/^cc-/, ''))) {
    return res.status(400).json({ error: 'Invalid new session name' });
  }
  const fullNewName = newName.startsWith(SESSION_PREFIX) ? newName : SESSION_PREFIX + newName;
  try {
    execFileSync(TMUX, ['rename-session', '-t', name, fullNewName], { encoding: 'utf-8', timeout: 5000 });
    invalidatePreview(name);
    attention.rename(name, fullNewName);
    aliasOnRename(name, fullNewName);
    // known-sessions mitziehen, damit Restore nach Rename den neuen Namen findet.
    try { await knownSessions.rename(name, fullNewName); } catch (e) { console.error('[known-sessions] rename failed:', e); }
    res.json({ success: true, name: fullNewName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore a dormant session: re-create in tmux with same cwd/command.
// Source of truth ist known-sessions.json — tmux weiß von dormant nichts.
app.post('/api/sessions/:name/restore', async (req, res) => {
  const { name } = req.params;
  if (!SESSION_NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Invalid session name' });
  }
  const entry = knownSessions.find(name);
  if (!entry) {
    return res.status(404).json({ error: 'Session not found in known-sessions' });
  }
  if (getTmuxSessions().some(s => s.name === name)) {
    return res.status(409).json({ error: 'Session with this name is already running' });
  }
  try {
    execFileSync(TMUX, ['new-session', '-d', '-s', name, ...hubEnvArgs(name), '-c', entry.directory, entry.command], {
      encoding: 'utf-8', timeout: 5000,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  for (let i = 0; i < 20; i++) {
    await sleep(40);
    const created = getTmuxSessions().find(s => s.name === name);
    if (created) {
      try {
        await knownSessions.add({ name, directory: entry.directory, command: entry.command });
      } catch (e) {
        console.error('[known-sessions] restore persist failed:', e);
      }
      return res.status(201).json({ ...created, status: 'running' });
    }
  }
  res.status(500).json({
    error: `Session "${name}" wurde gestartet, aber sofort wieder beendet. Wahrscheinlich ist "${entry.command}" nicht mehr im PATH.`,
  });
});

// Adopt a foreign tmux session: rename to cc-<newName>, persist to known.
// Command ist bei fremder Session unbekannt — 'claude' als Default, konsistent
// mit der Best-Effort-Adoption beim Server-Start.
app.post('/api/sessions/:name/adopt', async (req, res) => {
  const { name } = req.params;
  const { newName } = req.body;
  if (typeof name !== 'string' || !name) {
    return res.status(400).json({ error: 'Invalid source session name' });
  }
  if (typeof newName !== 'string' || !validSessionName(newName)) {
    return res.status(400).json({ error: 'Invalid new session name: letters/digits/dash/dot/underscore/spaces, 1-64 chars' });
  }
  const fullNewName = SESSION_PREFIX + newName;
  const live = getTmuxSessions();
  const source = live.find(s => s.name === name);
  if (!source) {
    return res.status(404).json({ error: 'Source session not found' });
  }
  if (live.some(s => s.name === fullNewName)) {
    return res.status(409).json({ error: 'Target session name already in use' });
  }
  try {
    execFileSync(TMUX, ['rename-session', '-t', name, fullNewName], { encoding: 'utf-8', timeout: 5000 });
    invalidatePreview(name);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  try {
    await knownSessions.add({ name: fullNewName, directory: source.path, command: 'claude' });
  } catch (e) {
    console.error('[known-sessions] adopt persist failed:', e);
  }
  res.status(200).json({ success: true, name: fullNewName });
});

// Forget a known-session entry (remove from JSON, tmux unaffected).
// Nur sinnvoll für dormant entries — running lässt sich auch entfernen,
// wird aber beim nächsten /api/sessions wieder als cc-prefixed running
// aufgelistet (ohne known-Eintrag).
app.delete('/api/sessions/:name/known', async (req, res) => {
  const { name } = req.params;
  if (!SESSION_NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Invalid session name' });
  }
  const removed = await knownSessions.remove(name);
  if (!removed) return res.status(404).json({ error: 'Not in known-sessions' });
  res.json({ success: true });
});

// ── WebSocket: Projekt-Events ────────────────────────────────────────────────
// Fan-out für fs.watch-Events aus lib/project-watcher.js. Clients abonnieren
// den Endpoint wenn sie den Projekte-Tab oder eine Detail-View offen haben;
// der Server broadcastet JEDES Projekt-Event an alle verbundenen Clients, die
// selbst filtern anhand der aktuell angezeigten Projekt-ID.
//
// Pattern: zentrale Subscriber-Set, einen einzelnen Watcher-Listener, keine
// per-Client-Registry-Pfade. Skaliert für den Single-User-Hub gut genug.
const projectEventClients = new Set();
projectWatcher.subscribe((event) => {
  const payload = JSON.stringify(event);
  for (const ws of projectEventClients) {
    if (ws.readyState === 1) {
      try { ws.send(payload); } catch {}
    }
  }
});

app.ws('/api/projects/events', (ws, req) => {
  if (AUTH_TOKEN && extractToken(req) !== AUTH_TOKEN) {
    ws.close(4001, 'Unauthorized');
    return;
  }
  projectEventClients.add(ws);
  try { ws.send(JSON.stringify({ type: 'hello' })); } catch {}
  ws.on('close', () => projectEventClients.delete(ws));
  ws.on('error', () => projectEventClients.delete(ws));
});

// ── Web Push: Broadcast bei session-attention ────────────────────────────────
// Sendet native Push-Notifications an alle registrierten Subscriptions wenn
// eine Session nach Stop/Notification unattached und nicht muted ist.
// 410 Gone = Subscription abgelaufen → automatisch löschen.
async function sendPushToAll(event) {
  const subs = pushSubs.allSubs();
  if (!subs.length) return;
  const displayName = (event.name || '').replace(/^cc-/, '');
  const activityLabels = { idle: 'Bereit', waiting: 'Braucht Input', working: 'Arbeitet' };
  const actLabel = activityLabels[event.activity] || 'Aktiv';
  const payload = JSON.stringify({
    title: `${displayName} — ${actLabel}`,
    body:  `Session "${displayName}" hat Output und wartet auf dich.`,
    name:  event.name,
    activity: event.activity,
  });
  const opts = { TTL: 60, urgency: 'normal' };
  const now = Date.now();

  await Promise.allSettled(subs.map(async (sub) => {
    const host = (() => {
      try { return new URL(sub.endpoint).host; } catch { return 'unknown'; }
    })();
    const ageH = sub.createdAt ? ((now - sub.createdAt) / 3_600_000).toFixed(1) : '?';
    const tag = `${host} dev=${sub.deviceId} age=${ageH}h`;

    try {
      await webpush.sendNotification(sub, payload, opts);
      console.log(`[push] delivered: ${tag} session=${event.name}`);
      await pushSubs.resetFailure(sub.endpoint).catch(() => {});
    } catch (err) {
      const status = err.statusCode ?? 0;
      let reason = null;
      try {
        const body = typeof err.body === 'string' ? err.body : '';
        const m = body.match(/"reason"\s*:\s*"([^"]+)"/);
        if (m) reason = m[1];
      } catch {}

      if (status === 410 || status === 404) {
        await pushSubs.removeSub(sub.endpoint).catch(() => {});
        console.log(`[push] gone, removed: ${tag} status=${status}`);
        return;
      }
      if (status === 401) {
        await pushSubs.removeSub(sub.endpoint).catch(() => {});
        console.log(`[push] unauthorized, removed: ${tag} status=401`);
        return;
      }
      if (status === 403) {
        await pushSubs.incrementFailure(sub.endpoint, { statusCode: 403, reason }).catch(() => {});
        console.warn(`[push] 403 ${reason || 'Forbidden'} (not removing): ${tag}`);
        return;
      }
      await pushSubs.incrementFailure(sub.endpoint, { statusCode: status, reason }).catch(() => {});
      console.warn(`[push] send failed: ${tag} status=${status} reason=${reason || '-'} msg=${err.message}`);
    }
  }));
}

// ── WebSocket: Notifications ─────────────────────────────────────────────────
// Attention-Events (session-attention) aus lib/attention.js an alle
// verbundenen Clients fan-outen. Eigener Channel statt Reuse von
// /api/projects/events, damit die beiden Domänen unabhängig bleiben.
const notificationClients = new Set();
attention.subscribe((event) => {
  const payload = JSON.stringify(event);
  for (const ws of notificationClients) {
    if (ws.readyState === 1) {
      try { ws.send(payload); } catch {}
    }
  }
  // Web-Push: nur bei echten Attention-Events (nicht bei activity-only Updates).
  if (event.type === 'session-attention') {
    sendPushToAll(event).catch((e) => console.error('[push] broadcast error:', e));
  }
});

app.ws('/api/notifications/events', (ws, req) => {
  if (AUTH_TOKEN && extractToken(req) !== AUTH_TOKEN) {
    ws.close(4001, 'Unauthorized');
    return;
  }
  notificationClients.add(ws);
  try { ws.send(JSON.stringify({ type: 'hello' })); } catch {}
  ws.on('close', () => notificationClients.delete(ws));
  ws.on('error', () => notificationClients.delete(ws));
});

// ── Web Push API ─────────────────────────────────────────────────────────────

// Subscription speichern. Body: { subscription: PushSubscriptionJSON, deviceId: string }
app.post('/api/push/subscribe', async (req, res) => {
  const sub = req.body?.subscription;
  const deviceId = req.body?.deviceId;
  if (!sub || !sub.endpoint) {
    return res.status(400).json({ error: 'Missing subscription' });
  }
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 128) {
    return res.status(400).json({ error: 'Missing or invalid deviceId' });
  }
  try {
    await pushSubs.saveSub({ ...sub, deviceId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Subscription entfernen. Body: { endpoint: string }
app.delete('/api/push/subscribe', async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
  const removed = await pushSubs.removeSub(endpoint);
  res.json({ ok: true, removed });
});

// Smoke-Test: an alle registrierten Subscriptions eine Dummy-Notification senden.
// Primäre Nutzung: UI-Button "Push-Test" + Debugging nach VAPID/Library-Changes.
app.post('/api/push/test', async (_req, res) => {
  const subs = pushSubs.allSubs();
  if (!subs.length) {
    return res.json({ ok: true, sent: 0, note: 'no subscriptions' });
  }
  await sendPushToAll({
    type: 'session-attention',
    name: 'cc-test',
    activity: 'waiting',
    at: Date.now(),
  });
  res.json({ ok: true, sent: subs.length });
});

// Mute/Unmute einer Session für Notifications. Body: { muted: bool }.
// Muted-Flag persistiert in known-sessions.json; Fremd-Sessions ohne
// known-Eintrag werden abgelehnt (404), weil wir nichts zu persistieren
// haben und bewusst keine Auto-Adoption triggern wollen.
app.post('/api/sessions/:name/mute', async (req, res) => {
  const { name } = req.params;
  if (!SESSION_NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Invalid session name' });
  }
  const muted = !!(req.body && req.body.muted);
  const ok = await knownSessions.setMuted(name, muted);
  if (!ok) return res.status(404).json({ error: 'Session not in known-sessions' });
  res.json({ success: true, name, muted });
});

// ── Claude-Code Hooks ────────────────────────────────────────────────────────
// Claude feuert in ~/.claude/settings.json konfigurierte Hooks für Events
// wie Stop/Notification/UserPromptSubmit. Jedes Hook-Script POSTet hier
// hin mit X-CC-Hub-Session (aus tmux-env CC_HUB_SESSION). Ergebnis: <100ms
// State-Update ohne Regex-Parsing. Auth läuft über die /api-Middleware.
const HOOK_EVENTS = new Set([
  'UserPromptSubmit', 'Stop', 'SubagentStop', 'Notification',
  'SessionStart', 'SessionEnd',
]);
// Eigener Body-Parser für Hook-Route: Claude's Hook-Stdin-JSON ist
// gelegentlich syntaktisch kaputt (z.B. `"line":}`), was express.json()
// mit 400 abbricht — unser Handler würde nie laufen und der State-Update
// wäre verloren. Wir nehmen Raw-Bytes, versuchen optimistisch zu parsen,
// und fallen bei Fehlern auf ein leeres Objekt zurück. Payload wird eh
// nicht ausgewertet, nur durchgereicht.
const hookBody = express.raw({ type: '*/*', limit: '1mb' });
app.post('/api/hooks/:event', hookBody, (req, res) => {
  const { event } = req.params;
  const envName = req.get('X-CC-Hub-Session');
  if (!envName || !SESSION_NAME_RE.test(envName)) {
    return res.status(400).json({ error: 'Missing or invalid X-CC-Hub-Session' });
  }
  if (!HOOK_EVENTS.has(event)) return res.status(204).end();
  let payload = {};
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    try { payload = JSON.parse(req.body.toString('utf8')); } catch { /* tolerant */ }
  }
  const sessionName = resolveHookSession(envName);
  attention.reportHookEvent(sessionName, event, payload);
  res.json({ ok: true, name: sessionName, event });
});

// ── WebSocket terminal ──────────────────────────────────────────────────────
// Tracking aller aktiven PTYs für Graceful Shutdown.
const activePtys = new Set();

app.ws('/api/terminal/:name', (ws, req) => {
  // Auth ist bereits durch die HTTP-Middleware geprüft worden (authMiddleware
  // akzeptiert Sec-WebSocket-Protocol). Defensiv nochmal checken, falls die
  // Middleware später umgebaut wird.
  if (AUTH_TOKEN && extractToken(req) !== AUTH_TOKEN) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  const sessionName = req.params.name;

  // Vor dem Spawn prüfen: existiert die Session?
  if (!getTmuxSessions().some(s => s.name === sessionName)) {
    try { ws.send(JSON.stringify({ type: 'error', message: `Session "${sessionName}" nicht gefunden` })); } catch {}
    ws.close(4004, 'Session not found');
    return;
  }

  const cols = parseInt(req.query.cols) || 120;
  const rows = parseInt(req.query.rows) || 40;

  let pty;
  try {
    // `-u` zwingt den tmux-Client in den UTF-8-Modus unabhängig vom Locale.
    // Zusätzlich LANG/LC_CTYPE im env, damit Child-Prozesse (claude & Co.)
    // ebenfalls eine UTF-8-Locale sehen.
    pty = spawn(TMUX, ['-u', 'attach-session', '-t', sessionName], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME,
      encoding: null,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        LANG: process.env.LANG || 'en_US.UTF-8',
        LC_CTYPE: process.env.LC_CTYPE || 'en_US.UTF-8',
      },
    });
  } catch (err) {
    try { ws.send(JSON.stringify({ type: 'error', message: `Failed to attach: ${err.message}` })); } catch {}
    ws.close();
    return;
  }

  activePtys.add(pty);

  pty.onData(data => {
    if (ws.readyState === 1) {
      try { ws.send(data, { binary: true }); } catch {}
    }
  });

  pty.onExit(() => {
    activePtys.delete(pty);
    try { ws.close(); } catch {}
  });

  ws.on('message', msg => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'resize') pty.resize(parsed.cols, parsed.rows);
      else if (parsed.type === 'input') pty.write(parsed.data);
    } catch {
      pty.write(msg);
    }
  });

  ws.on('close', () => {
    activePtys.delete(pty);
    try { pty.kill(); } catch {}
  });
});

// ── Fallback to index.html (SPA routing) ─────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ── Start + Graceful Shutdown ───────────────────────────────────────────────
const server = app.listen(PORT, async () => {
  console.log(`\n  ⚡ Claude Code Hub running at http://localhost:${PORT}\n`);
  try {
    await knownSessions.load();
    console.log(`  ▸ known-sessions: ${knownSessions.list().length} entries loaded`);
    // Best-effort Adoption: alle aktuell laufenden cc-* Sessions, die wir
    // noch nicht kennen, ins File eintragen. Der Fall tritt nach Updates
    // auf älteren Hub-Installationen auf oder wenn der User die JSON-Datei
    // manuell gelöscht hat.
    //
    // Zwei bewusste Lossy-Punkte:
    //   1. `command: 'claude'` ist geraten — tmux gibt den ursprünglichen
    //      argv nicht her. Konsistent mit dem /adopt-Endpoint (Task 4).
    //      Falls der User die Session mit einem anderen Command gestartet
    //      hatte, muss er die Karte nach einem Restore ggf. neu anlegen.
    //   2. `directory: s.path` kommt aus `#{pane_current_path}`, nicht
    //      aus dem ursprünglichen `-c`. Nach `cd` im Shell ist der Wert
    //      gedriftet. Für Restore besser als gar nichts.
    //
    // knownSessions.add serialisiert intern (saveQueue), daher safe
    // gegenüber parallelen POST /api/sessions während des Startups.
    const live = getTmuxSessions();
    const knownNames = new Set(knownSessions.list().map(e => e.name));
    for (const s of live) {
      if (s.name.startsWith(SESSION_PREFIX) && !knownNames.has(s.name)) {
        await knownSessions.add({ name: s.name, directory: s.path, command: 'claude' });
      }
    }
  } catch (err) {
    console.error('[known-sessions] load failed:', err);
  }

  // Attention-Engine: Mute-Checker registrieren. Zustand wird
  // ausschließlich aus ~/.claude/settings.json-Hooks gespeist, kein
  // eigener Poll-Loop mehr.
  attention.setMuteChecker((name) => knownSessions.isMuted(name));
  console.log('  ▸ attention-engine: hook-only');

  // Web Push: VAPID-Keys laden (ggf. generieren) + Subscriptions laden.
  try {
    await loadVapid();
    console.log('  ▸ web-push: VAPID-Keys geladen');
  } catch (e) {
    console.error('[vapid] load failed:', e.message);
  }
  try {
    await pushSubs.loadSubs();
    console.log(`  ▸ web-push: ${pushSubs.allSubs().length} Subscription(s) geladen`);
  } catch (e) {
    console.error('[push-subs] load failed:', e.message);
  }
});

// Heartbeat: alle 60s lastSeenAt für laufende bekannte Sessions updaten.
// Das gibt uns in der UI einen belastbaren "zuletzt gesehen"-Wert für
// dormant Cards, sobald die Session wegbricht.
const HEARTBEAT_INTERVAL_MS = 60_000;
const heartbeatTimer = setInterval(async () => {
  try {
    const liveNames = getTmuxSessions().map(s => s.name);
    const known = new Set(knownSessions.list().map(e => e.name));
    const toTouch = liveNames.filter(n => known.has(n));
    if (toTouch.length) await knownSessions.touchMany(toTouch);
  } catch (e) {
    console.error('[heartbeat]', e);
  }
}, HEARTBEAT_INTERVAL_MS);
heartbeatTimer.unref();

function shutdown(signal) {
  console.log(`\n  ${signal} received — killing ${activePtys.size} active PTY(s) and shutting down`);
  clearInterval(heartbeatTimer);
  for (const p of activePtys) { try { p.kill(); } catch {} }
  projectWatcher.closeAll();
  attention.stop();
  server.close(() => process.exit(0));
  // Force-Exit falls server.close() hängt.
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Projekt-Discovery einmalig beim Startup. Scan-Roots sind konfigurierbar
// via PROJECT_ROOTS (comma-separated), Default: ~/Projects.
// Nach Discovery werden die fs.watch-Watcher angezogen.
const projectRoots = (process.env.PROJECT_ROOTS || join(HOME, 'Projects'))
  .split(',').map(s => s.trim()).filter(Boolean)
  .map(p => (p === '~' || p.startsWith('~/')) ? join(HOME, p.slice(1)) : p);
discoverProjects(projectRoots)
  .then(async (r) => {
    console.log(`[projects] discovery: +${r.added}, total=${r.total}`);
    const reg = await loadRegistry();
    projectWatcher.syncWatchers(reg);
    console.log(`[projects] watchers: ${projectWatcher._debugState().watching.length} active`);
  })
  .catch(e => console.error('[projects] discovery failed:', e.message));
