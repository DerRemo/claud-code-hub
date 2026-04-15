# Remote-Zugriff-Härtung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei neue Sicherheits-Layer für den Hub: Cloudflare-Access-JWT-Validation vor dem Tunnel, Fixed-Window-Rate-Limiting auf REST-Endpoints, und append-only JSONL-Audit-Log für security-relevante Events.

**Architecture:** Drei neue Module unter `lib/` mit kleinen, gut definierten Schnittstellen. Der existierende Bearer-Auth-Flow bleibt unverändert — `secureMiddleware` erweitert ihn um JWT-Validation für Tunnel-Requests und Audit-Log-Events. Rate-Limiting hängt als zweite Middleware zwischen Auth und Route-Dispatch. Alle drei Features sind durch `.env`-Toggles rollbackbar; ohne `CF_ACCESS_*`-Config läuft der Server im bisherigen Bearer-only-Modus weiter.

**Tech Stack:** Node/Express + express-ws, ES Modules, eine neue npm-Dependency (`jose`), kein Build-Step, keine Test-Suite (per `CLAUDE.md`). Manuelles Testing via curl + Browser + LaunchAgent-Restart.

**Spec:** `docs/superpowers/specs/2026-04-15-remote-access-hardening-design.md`

**Testing-Umgebung:**
- Der Hub läuft via LaunchAgent auf Port 3333, extern erreichbar via `https://code.derremo.xyz`.
- Nach Code-Änderung muss der LaunchAgent neugestartet werden: `launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub`
- Desktop-Tests via curl an `http://localhost:3333`.
- Browser-Tests (Cloudflare-Access-Flow) via iPhone oder Mac-Browser auf `https://code.derremo.xyz`.
- **Jede Task endet mit einem Commit + LaunchAgent-Restart + Smoke-Test.**

**Line-Number-Regel:** Zeilennummern in diesem Plan beziehen sich auf den Stand **vor** Task 1. Nach jedem Commit verschieben sich Zeilen. Zum Finden von Code-Stellen: grep nach Text-Ankern (z.B. `// ── Auth middleware`), nicht blind Zeilennummern verwenden.

---

## File Structure

**Created files:**
- `lib/cf-access.js` — JWKS-Cache + JWT-Validation (exportiert: `isEnabled`, `verifyJwtFromRequest`, `isNewLoginIat`, `InvalidJwtError`)
- `lib/rate-limit.js` — In-memory Fixed-Window Counter Factory (exportiert: `createRateLimiter`)
- `lib/audit-log.js` — JSONL Writer mit Size-Rotation (exportiert: `record`, `extractRequestMeta`)

**Modified files:**
- `server.js` — `secureMiddleware` ersetzt `authMiddleware`, Rate-Limiter werden gewiredt, Audit-Log-Calls in Session-CRUD und Terminal-WS-Handler eingefügt
- `package.json` + `package-lock.json` — neue Dependency `jose`
- `.env.example` — neue Variablen dokumentiert

**No files deleted.**

---

## Task 1: `lib/cf-access.js` — JWKS-Cache + JWT-Verify

**Files:**
- Install: `jose` via npm
- Create: `lib/cf-access.js`

**Kontext:** Cloudflare Access signiert JWTs mit rotierenden RS256-Keys. Die Public-Keys liegen unter `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` als JWKS. Wir laden sie beim Start, cachen sie 1 Stunde, und verifizieren eingehende `Cf-Access-Jwt-Assertion`-Header mit der `jose`-Library. Bei fehlendem oder unset `CF_ACCESS_TEAM_DOMAIN` und `CF_ACCESS_AUD` ist das Modul disabled (Dev-Mode) und `isEnabled()` gibt `false`.

- [ ] **Step 1.1: Install `jose`**

```bash
cd /Users/rocky/Projects/claude-code-hub && npm install jose
```

Expected: `jose` taucht in `package.json` als Dependency auf, `package-lock.json` wird aktualisiert. Kein Vulnerability-Warning bei Install.

- [ ] **Step 1.2: Create `lib/cf-access.js`**

Schreibe die komplette Datei:

```javascript
// Cloudflare Access JWT validation mit JWKS-Cache.
//
// Wird vom secureMiddleware in server.js aufgerufen, wenn ein Request
// vom Tunnel kommt (Cf-Ray-Header präsent). Prüft die Signatur des
// Cf-Access-Jwt-Assertion-Headers gegen den JWKS von Cloudflare, verifiziert
// Audience-Tag + Expiry und extrahiert die Email-Claim als User-Identity.
//
// Config via zwei Env-Variablen:
//   CF_ACCESS_TEAM_DOMAIN — z.B. derremo.cloudflareaccess.com
//   CF_ACCESS_AUD         — Application-Audience-Tag aus dem Cloudflare-Dashboard
//
// Beide leer/unset → Modul ist disabled, isEnabled() liefert false, der
// secureMiddleware überspringt die JWT-Validation. Ermöglicht lokale
// Entwicklung und staged Rollout.

import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';

const TEAM_DOMAIN = process.env.CF_ACCESS_TEAM_DOMAIN || '';
const AUDIENCE    = process.env.CF_ACCESS_AUD         || '';

// Klasse für machine-lesbare Error-Codes. Der secureMiddleware mapt
// .code auf das audit-log 'reason'-Feld.
export class InvalidJwtError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

// jose's createRemoteJWKSet erledigt JWKS-Fetch + Cache + Refresh
// automatisch. Wir setzen cooldownDuration damit rapid-fire bad-kid-
// Requests keinen DDoS-Angriffsvektor geben.
let jwks = null;
function getJwks() {
  if (!TEAM_DOMAIN) return null;
  if (jwks) return jwks;
  const url = new URL(`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`);
  jwks = createRemoteJWKSet(url, {
    cooldownDuration: 30_000,  // min 30s zwischen Refreshes bei bad-kid
    cacheMaxAge: 60 * 60_000,  // JWKS 1h cachen, danach Refresh beim nächsten Use
  });
  return jwks;
}

export function isEnabled() {
  return !!(TEAM_DOMAIN && AUDIENCE);
}

// Prüft den Cf-Access-Jwt-Assertion-Header des Requests gegen die
// JWKS. Wirft InvalidJwtError mit .code ∈ {no-jwt, bad-sig, expired,
// bad-aud, no-email, unknown}.
export async function verifyJwtFromRequest(req) {
  const raw = req.headers['cf-access-jwt-assertion'];
  if (!raw) throw new InvalidJwtError('no-jwt');
  const keySet = getJwks();
  if (!keySet) throw new InvalidJwtError('no-jwt');  // kann nicht passieren wenn isEnabled() vorher geprüft wurde
  try {
    const { payload } = await jwtVerify(raw, keySet, { audience: AUDIENCE });
    if (!payload.email) throw new InvalidJwtError('no-email');
    return { email: payload.email, sub: payload.sub || null, iat: payload.iat || null };
  } catch (e) {
    if (e instanceof InvalidJwtError) throw e;
    if (e instanceof joseErrors.JWTExpired) throw new InvalidJwtError('expired');
    if (e instanceof joseErrors.JWTClaimValidationFailed && e.claim === 'aud') {
      throw new InvalidJwtError('bad-aud');
    }
    if (e instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new InvalidJwtError('bad-sig');
    }
    if (e instanceof joseErrors.JWSInvalid || e instanceof joseErrors.JWTInvalid) {
      throw new InvalidJwtError('bad-sig');
    }
    throw new InvalidJwtError('unknown', e.message);
  }
}

// In-memory Tracker für `auth.login`-Event-Detection. Pro Email merken
// wir uns die letzte gesehene `iat`-Claim. Wenn der nächste JWT einen
// höheren iat hat, ist es eine neue Access-Session → wir loggen es
// einmal als auth.login. Map wird beim Server-Restart zurückgesetzt,
// sodass der erste JWT nach Restart immer als Login zählt. Akzeptabel.
const lastSeenIat = new Map();
export function isNewLoginIat(email, iat) {
  if (!email || !iat) return false;
  const prev = lastSeenIat.get(email);
  if (prev && prev >= iat) return false;
  lastSeenIat.set(email, iat);
  return true;
}
```

- [ ] **Step 1.3: Smoke-Test — Dev-Mode ohne Env**

Env-Variablen NICHT setzen. Erstelle ein throwaway-Testscript:

```bash
node -e "import('./lib/cf-access.js').then(m => { console.log('isEnabled:', m.isEnabled()); })"
```

Expected: `isEnabled: false`. Kein Import-Fehler.

- [ ] **Step 1.4: Smoke-Test — Enabled-Mode mit dummy Env**

```bash
CF_ACCESS_TEAM_DOMAIN=example.cloudflareaccess.com CF_ACCESS_AUD=dummy node -e "import('./lib/cf-access.js').then(m => { console.log('isEnabled:', m.isEnabled()); })"
```

Expected: `isEnabled: true`. Keine Netzwerk-Calls (JWKS lädt lazy).

- [ ] **Step 1.5: Commit**

```bash
cd /Users/rocky/Projects/claude-code-hub && git add package.json package-lock.json lib/cf-access.js && git commit -m "$(cat <<'EOF'
remote-sec: lib/cf-access.js — JWKS-Cache + JWT-Verify

Neues Modul validiert Cloudflare-Access-JWTs gegen die von Cloudflare
signierte JWKS. Config via CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD env,
beide leer → Dev-Mode (isEnabled() = false). InvalidJwtError mit
machine-lesbarem .code-Feld für Audit-Log-Mapping. isNewLoginIat
trackt pro Email den letzten iat-Claim, damit der secureMiddleware
den ersten JWT einer neuen Access-Session als auth.login-Event
loggen kann.

Dependency jose neu (de-facto Standard für JWKS+JWT in Node, zero-dep).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `lib/rate-limit.js` — Fixed-Window Rate Limiter Factory

**Files:**
- Create: `lib/rate-limit.js`

**Kontext:** In-memory `Map<ip, {count, windowStart}>`, zwei getrennte Instanzen via Factory für Read und Write Buckets. Key-Funktion zieht `Cf-Connecting-Ip` (Cloudflare-Header) bevorzugt, fällt auf `req.ip` zurück. Bei Überschreitung: 429 mit Retry-After. Audit-Log-Call geht nicht hier raus — das macht der Caller über einen optionalen `onExceeded`-Hook (damit das Modul keinen zirkulären Import auf `audit-log.js` braucht).

- [ ] **Step 2.1: Create `lib/rate-limit.js`**

```javascript
// Fixed-Window Rate Limiter als Express-Middleware-Factory.
//
// Zwei Buckets werden in server.js instanziiert:
//   - Read  (GET/HEAD): 300 req / 60s per IP
//   - Write (POST/PUT/PATCH/DELETE): 60 req / 60s per IP
//
// Keine separaten Cleanup-Timer: stale Einträge werden beim nächsten
// Check derselben IP überschrieben. Der Speicher-Footprint ist
// proportional zur Zahl unique IPs die je mit dem Hub geredet haben,
// was bei einem Single-User-Hub klein bleibt.
//
// Das Modul ruft auditLog NICHT direkt — der Caller kann optional
// einen onExceeded(req, {bucket, max, windowMs})-Callback übergeben,
// der bei 429 gefeuert wird. Damit bleibt das Modul unabhängig vom
// audit-log und die Reihenfolge der Module-Imports in server.js
// ist unkritisch.

function defaultKeyFn(req) {
  return req.headers['cf-connecting-ip'] || req.ip || 'unknown';
}

export function createRateLimiter({ bucket, max, windowMs, keyFn = defaultKeyFn, onExceeded = null }) {
  if (!bucket) throw new Error('rate-limit: bucket name required');
  if (typeof max !== 'number' || max <= 0) throw new Error('rate-limit: max must be a positive number');
  if (typeof windowMs !== 'number' || windowMs <= 0) throw new Error('rate-limit: windowMs must be a positive number');

  const buckets = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const key = keyFn(req);
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: now };
      buckets.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      if (onExceeded) {
        try { onExceeded(req, { bucket, max, windowMs }); } catch { /* swallow */ }
      }
      return res.status(429).json({ error: 'Rate limit exceeded', retryAfter });
    }
    next();
  };
}
```

- [ ] **Step 2.2: Smoke-Test**

```bash
cd /Users/rocky/Projects/claude-code-hub && node -e "
import('./lib/rate-limit.js').then(m => {
  const limiter = m.createRateLimiter({ bucket: 'test', max: 3, windowMs: 1000 });
  let calls = 0;
  const fakeReq = { headers: {}, ip: '1.2.3.4' };
  const fakeRes = {
    setHeader: () => {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  for (let i = 0; i < 5; i++) {
    limiter(fakeReq, fakeRes, () => { calls++; });
  }
  console.log('calls through:', calls);
  console.log('final status:', fakeRes.statusCode);
  console.log('final body:', fakeRes.body);
})
"
```

Expected:
```
calls through: 3
final status: 429
final body: { error: 'Rate limit exceeded', retryAfter: 1 }
```

- [ ] **Step 2.3: Commit**

```bash
git add lib/rate-limit.js && git commit -m "$(cat <<'EOF'
remote-sec: lib/rate-limit.js — Fixed-Window Rate-Limit Factory

Neues Modul liefert createRateLimiter({bucket,max,windowMs}) → Express-
Middleware. In-memory Map pro Bucket-Instanz, Key-Funktion bevorzugt
Cf-Connecting-Ip mit req.ip Fallback. 429 mit Retry-After auf
Überschreitung. Optionaler onExceeded-Callback entkoppelt das Modul
vom audit-log (kein Zirkular-Import).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `lib/audit-log.js` — JSONL Writer mit Rotation

**Files:**
- Create: `lib/audit-log.js`

**Kontext:** Append-only JSONL zu `~/.claude-code-hub/audit.log`. Size-basierte Rotation (10 MB, 3 Archive). In-memory Size-Cache vermeidet `fs.stat` pro Write. Serialisierter Write-Path via `saveQueue` Promise-Chain (dasselbe Muster wie `lib/known-sessions.js`). `extractRequestMeta(req)` zieht `user`, `ip`, `cfRay`, `userAgent` aus dem Request.

- [ ] **Step 3.1: Create `lib/audit-log.js`**

```javascript
// Append-only JSONL-Audit-Log für security-relevante Events.
//
// Jeder Event eine JSON-Line in ~/.claude-code-hub/audit.log.
// Size-basierte Rotation: bei >10MB wird umbenannt (audit.log → .log.1,
// .log.1 → .log.2, .log.2 → .log.3, alte .3 geht verloren).
//
// Writes sind serialisiert via saveQueue Promise-Chain — identisches
// Muster wie lib/known-sessions.js. Damit sind Rotationen race-frei
// gegen parallele Event-Writes.
//
// Crash-Safety: fs.appendFile ist atomar für Writes ≤ PIPE_BUF (4096B
// auf macOS). Unsere Records sind 200-500B. Bei Prozess-Crash mitten
// im Write bleibt höchstens eine unvollständige letzte Line — jq
// überspringt die, Datei bleibt sonst intakt.

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const STORE_DIR = join(homedir(), '.claude-code-hub');
const AUDIT_PATH = join(STORE_DIR, 'audit.log');
const MAX_SIZE_BYTES = 10 * 1024 * 1024;  // 10 MB
const MAX_ARCHIVES = 3;

let cachedSize = null;  // null = uninitialized, sonst Bytes
let saveQueue = Promise.resolve();

async function initCachedSize() {
  if (cachedSize !== null) return;
  try {
    const s = await fs.stat(AUDIT_PATH);
    cachedSize = s.size;
  } catch (err) {
    if (err.code === 'ENOENT') cachedSize = 0;
    else throw err;
  }
}

async function maybeRotate(incomingBytes) {
  await initCachedSize();
  if (cachedSize + incomingBytes < MAX_SIZE_BYTES) return;
  // Rotate: .2 → .3, .1 → .2, active → .1. Alte .3 wird überschrieben.
  for (let i = MAX_ARCHIVES - 1; i >= 1; i--) {
    try {
      await fs.rename(`${AUDIT_PATH}.${i}`, `${AUDIT_PATH}.${i + 1}`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  try {
    await fs.rename(AUDIT_PATH, `${AUDIT_PATH}.1`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  cachedSize = 0;
}

async function doRecord(event, fields) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };
  const line = JSON.stringify(payload) + '\n';
  const bytes = Buffer.byteLength(line, 'utf-8');
  await fs.mkdir(STORE_DIR, { recursive: true });
  await maybeRotate(bytes);
  await fs.appendFile(AUDIT_PATH, line, 'utf-8');
  cachedSize = (cachedSize || 0) + bytes;
}

// Serialisiert den Write gegen parallele Calls. Gibt das Promise des
// Write-Calls zurück — Caller kann `await` wenn sie Crash-Safety wollen,
// oder fire-and-forget wenn Latency wichtiger ist.
export function record(event, fields = {}) {
  const next = saveQueue.then(() => doRecord(event, fields), () => doRecord(event, fields));
  saveQueue = next.catch(() => {});  // Chain schwalbt Errors, damit der nächste Write nicht auf dem alten Fehler stehen bleibt
  return next;
}

// Extrahiert Standard-Request-Meta. Benutzt req.cchContext falls
// secureMiddleware es gesetzt hat (enthält user aus JWT-Claim).
export function extractRequestMeta(req) {
  return {
    user: req.cchContext?.user || null,
    ip: req.headers['cf-connecting-ip'] || req.ip || null,
    cfRay: req.headers['cf-ray'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

// Nur für Tests/Debug.
export const _internal = { AUDIT_PATH, MAX_SIZE_BYTES, MAX_ARCHIVES };
```

- [ ] **Step 3.2: Smoke-Test — Write + Read**

```bash
cd /Users/rocky/Projects/claude-code-hub && node -e "
import('./lib/audit-log.js').then(async m => {
  await m.record('test.event', { foo: 'bar', n: 42 });
  await m.record('test.event2', { other: 'value' });
  console.log('wrote 2 events');
})
"
```

Expected: `wrote 2 events`, keine Errors.

Prüfen dass die Datei existiert und die JSON-Lines drin sind:
```bash
tail -2 ~/.claude-code-hub/audit.log
```

Expected: zwei valid JSON-Zeilen mit `ts`, `event`, und den custom Feldern. Kein vorhandenes Log muss überschrieben werden — das wird beim ersten Hub-Restart überschrieben, das ist OK.

- [ ] **Step 3.3: Commit**

```bash
git add lib/audit-log.js && git commit -m "$(cat <<'EOF'
remote-sec: lib/audit-log.js — JSONL audit log mit rotation

Neues Modul schreibt JSON-Lines nach ~/.claude-code-hub/audit.log.
Size-basierte Rotation (10MB/3 Archive), write-serialisiert via
saveQueue-Pattern, crash-safe durch atomare fs.appendFile calls.
record(event, fields) returned Promise — Caller entscheidet
await vs fire-and-forget pro Event. extractRequestMeta(req) liefert
{user, ip, cfRay, userAgent} aus req.cchContext + Headers.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `server.js` — `secureMiddleware` ersetzt `authMiddleware`

**Files:**
- Modify: `server.js`

**Kontext:** Der existierende `authMiddleware` (Zeilen 166–171) wird durch einen neuen `secureMiddleware` ersetzt, der `cf-access` und `audit-log` integriert. Auf Tunnel-Requests (Cf-Ray-Header präsent) fordert die Middleware JWT + Bearer. Auf Localhost-Requests (kein Cf-Ray) nur Bearer. Auth-Fehler schreiben `auth.fail`-Events, ein frischer JWT-Login schreibt `auth.login`. `req.cchContext` bekommt `{user, ip, cfRay, userAgent}` für Downstream-Handler.

**Wichtiger Punkt:** Der WS-Handler (`/api/terminal/:name`, Zeile ~1116) macht seinen eigenen defensiven Token-Check. Der muss **nicht** angepasst werden — er wird durch den neuen Middleware ersetzt-in-effect, weil express-ws die Middleware-Chain auch auf WS-Upgrades anwendet. Aber: damit der secureMiddleware WS-Requests korrekt erkennt (sie haben einen Sec-WebSocket-Protocol-Header für den Bearer, nicht Authorization), muss `extractToken(req)` weiter funktionieren — das tut es, weil wir es nicht anfassen.

- [ ] **Step 4.1: Import-Section erweitern**

Grep für `import * as knownSessions from './lib/known-sessions.js';` in `server.js`. Direkt darunter füge hinzu:

```javascript
import * as cfAccess from './lib/cf-access.js';
import * as auditLog from './lib/audit-log.js';
import { createRateLimiter } from './lib/rate-limit.js';
```

- [ ] **Step 4.2: `authMiddleware` → `secureMiddleware`**

Grep für `function authMiddleware(req, res, next)`. Ersetze den ganzen Block (inklusive der `extractToken`-Funktion, die bleibt, und des Kommentar-Headers):

```javascript
// ── Secure middleware ────────────────────────────────────────────────────────
// Kombiniert zwei Auth-Layer:
//   1. Cloudflare Access JWT (nur bei Tunnel-Requests, erkannt an Cf-Ray-Header)
//      Wenn cfAccess.isEnabled() false ist (CF_ACCESS_* unset), wird
//      der JWT-Check übersprungen — Dev-Mode.
//   2. Bearer-Token aus Header/Query/WS-Subprotocol (immer, unabhängig von JWT).
//
// Beide Fehlermodi schreiben auth.fail-Events ins audit-log. Erster JWT
// einer neuen Access-Session schreibt auth.login einmalig.
// req.cchContext bekommt {user, ip, cfRay, userAgent} für Downstream.
//
// Akzeptiert drei Bearer-Token-Quellen:
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

async function secureMiddleware(req, res, next) {
  // Meta früh extrahieren — req.cchContext existiert noch nicht, also
  // ziehen wir die Rohwerte. Wird nach erfolgreicher Auth durch context
  // mit user angereichert.
  const rawMeta = {
    user: null,
    ip: req.headers['cf-connecting-ip'] || req.ip || null,
    cfRay: req.headers['cf-ray'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
  const fromTunnel = !!rawMeta.cfRay;

  // 1. JWT-Check (nur bei Tunnel-Traffic UND wenn cfAccess enabled)
  let jwtUser = null;
  if (fromTunnel && cfAccess.isEnabled()) {
    try {
      const claim = await cfAccess.verifyJwtFromRequest(req);
      jwtUser = claim.email;
      // Fire-and-forget ist OK für Login: wenn der Prozess crashed direkt
      // nach JWT-verify aber vor dem appendFile, verlieren wir einen
      // Event — der nächste JWT-Request aus derselben Access-Session
      // feuert es erneut wenn der lastSeenIat-Map-Zustand weg ist.
      if (cfAccess.isNewLoginIat(claim.email, claim.iat)) {
        auditLog.record('auth.login', { ...rawMeta, user: claim.email });
      }
    } catch (e) {
      const code = e.code || 'unknown';
      // Security-Event: awaited damit bei Crash garantiert persistiert.
      await auditLog.record('auth.fail', { ...rawMeta, reason: `bad-jwt:${code}` });
      return res.status(401).json({ error: 'Unauthorized (JWT)' });
    }
  }

  // 2. Bearer-Check (immer, unabhängig von JWT)
  if (AUTH_TOKEN) {
    const token = extractToken(req);
    if (token !== AUTH_TOKEN) {
      await auditLog.record('auth.fail', {
        ...rawMeta,
        user: jwtUser,
        reason: token ? 'bad-bearer' : 'no-token',
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Auth OK → Kontext setzen für Downstream-Handler
  req.cchContext = { ...rawMeta, user: jwtUser };
  next();
}
```

- [ ] **Step 4.3: Den `app.use('/api', authMiddleware)` call aktualisieren**

Grep für `app.use('/api', authMiddleware);`. Ersetze durch:

```javascript
app.use('/api', secureMiddleware);
```

- [ ] **Step 4.4: Defensive Checks in den anderen Auth-Sites aktualisieren**

Es gibt drei Stellen im `server.js` die `AUTH_TOKEN && extractToken(req) !== AUTH_TOKEN` direkt prüfen (Zeilen ~844, ~971, ~1120). Diese defensiven Checks sind in Routes, die durch `/api/...` bereits den `secureMiddleware` durchlaufen haben — sie sind redundant, aber wir lassen sie drin als zusätzliche Verteidigungsschicht. **Ändere nichts an diesen drei Stellen.**

- [ ] **Step 4.5: LaunchAgent restart + Dev-Mode Smoke-Test**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub && sleep 1
AUTH=$(grep ^AUTH_TOKEN .env | cut -d= -f2)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/api/sessions -H "Authorization: Bearer $AUTH"
```

Expected: `200`. Dev-Mode-Pfad funktioniert: CF_ACCESS_* sind nicht gesetzt, also überspringt die Middleware JWT-Validation, nur Bearer wird geprüft.

- [ ] **Step 4.6: Auth-Fail-Event-Smoke-Test**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/api/sessions -H "Authorization: Bearer wrongtoken"
```

Expected: `401`. Jetzt prüfen:

```bash
tail -1 ~/.claude-code-hub/audit.log
```

Expected: eine JSON-Zeile mit `"event":"auth.fail"`, `"reason":"bad-bearer"`, `"ip":"..."`.

- [ ] **Step 4.7: Commit**

```bash
git add server.js && git commit -m "$(cat <<'EOF'
remote-sec: server.js — secureMiddleware ersetzt authMiddleware

Der alte authMiddleware wird zu secureMiddleware aufgebohrt: auf
Tunnel-Requests (Cf-Ray präsent) wird zusätzlich ein Cloudflare-Access-
JWT validiert (wenn cfAccess.isEnabled()), bei Fehler wird auth.fail
ins audit-log geschrieben. Erster JWT einer Access-Session schreibt
auth.login. req.cchContext wird mit {user, ip, cfRay, userAgent}
dekoriert für Downstream-Handler und audit-log-Aufrufe.

Die drei bestehenden defensiven Bearer-Checks in den Auth-Sites
weiter unten bleiben als zweite Schicht unverändert.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rate-Limiting in `server.js` verdrahten

**Files:**
- Modify: `server.js`

**Kontext:** Direkt nach `app.use('/api', secureMiddleware);` wird der Rate-Limit-Dispatcher eingefügt. Er unterscheidet Read vs. Write per HTTP-Methode und routed auf zwei getrennte Limiter-Instanzen. `/api/hooks/*` ist explizit exempt, weil Claude-Code-Hooks hohe Event-Raten haben.

- [ ] **Step 5.1: Limiter-Instanzen + Dispatcher einfügen**

Grep für `app.use('/api', secureMiddleware);`. Direkt danach füge ein:

```javascript
// ── Rate-Limiting ────────────────────────────────────────────────────────────
// Zwei Buckets via createRateLimiter: Read (GET/HEAD) und Write (sonst).
// Hooks sind exempt weil Claude-Code bei heißen Sessions viele
// UserPromptSubmit-Events pro Minute feuern kann und legitime Events
// sonst gedroppt würden. /healthz liegt außerhalb von /api/* und ist
// schon dadurch ausgenommen.
//
// onExceeded-Callback feuert rate-limit.exceeded ins audit-log.
const rlOnExceeded = (req, info) => {
  auditLog.record('rate-limit.exceeded', {
    ...auditLog.extractRequestMeta(req),
    bucket: info.bucket,
    max: info.max,
    windowMs: info.windowMs,
  });
};
const readLimiter  = createRateLimiter({ bucket: 'read',  max: 300, windowMs: 60_000, onExceeded: rlOnExceeded });
const writeLimiter = createRateLimiter({ bucket: 'write', max:  60, windowMs: 60_000, onExceeded: rlOnExceeded });

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/hooks/')) return next();
  if (req.method === 'GET' || req.method === 'HEAD') return readLimiter(req, res, next);
  return writeLimiter(req, res, next);
});
```

- [ ] **Step 5.2: LaunchAgent restart + Smoke-Test Read-Bucket**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub && sleep 1
AUTH=$(grep ^AUTH_TOKEN .env | cut -d= -f2)
for i in $(seq 1 305); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/api/sessions -H "Authorization: Bearer $AUTH"
done | sort | uniq -c
```

Expected: etwa `300 200` und `5 429` (erste 300 durch, letzte 5 gerate-limited). Die Reihenfolge kann variieren aber die Verteilung muss 300:5 sein.

- [ ] **Step 5.3: Smoke-Test `rate-limit.exceeded` Event**

```bash
tail -10 ~/.claude-code-hub/audit.log | grep rate-limit
```

Expected: mindestens eine JSON-Zeile mit `"event":"rate-limit.exceeded"`, `"bucket":"read"`.

- [ ] **Step 5.4: Smoke-Test Hook-Exempt**

```bash
# Reset Read-Bucket via 65 Sekunden warten — oder neu starten (schneller):
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub && sleep 1
# 400 Hook-Requests feuern
for i in $(seq 1 400); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3333/api/hooks/Stop \
    -H "Authorization: Bearer $AUTH" \
    -H "X-CC-Hub-Session: cc-nonexistent" \
    -H "Content-Type: application/json" -d '{}'
done | sort | uniq -c
```

Expected: alle 400 Responses sind 200 oder 404 (Session nicht gefunden) — **keine einzige 429**.

- [ ] **Step 5.5: Commit**

```bash
git add server.js && git commit -m "$(cat <<'EOF'
remote-sec: server.js — Rate-Limiting auf /api/* (hooks exempt)

Zwei createRateLimiter-Instanzen hinter secureMiddleware: Read (GET/HEAD
mit 300/60s) und Write (POST/PUT/PATCH/DELETE mit 60/60s) pro IP.
Dispatcher routed nach HTTP-Methode. /api/hooks/* ist explizit exempt
weil Claude-Code-Hooks hohe Event-Raten haben. onExceeded-Callback
feuert rate-limit.exceeded ins audit-log.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Audit-Log-Events an Session-Lifecycle-Sites

**Files:**
- Modify: `server.js`

**Kontext:** Jetzt wo audit-log verdrahtet ist, müssen die eigentlichen Event-Aufrufe an den richtigen Stellen eingefügt werden. Fünf Events: `session.create`, `session.delete`, `session.rename`, `session.attach`, `session.detach`.

- [ ] **Step 6.1: `session.create` in `POST /api/sessions`**

Grep nach `app.post('/api/sessions'` und finde die success-path-Stelle (der Handler polled auf Session-Existenz, dann kommt ein Antwort-Block). Direkt vor der erfolgreichen `res.json(...)` für die erstellte Session füge ein:

Suche diesen Block (ungefähr Zeile 590-620):
```javascript
  for (let i = 0; i < 20; i++) {
    await sleep(40);
    const created = getTmuxSessions().find(s => s.name === sessionName);
    if (created) {
```

Es gibt danach einen `res.json(...)`-Call mit dem created-Objekt. **Direkt vor** diesem `res.json` füge hinzu:

```javascript
      // Lifecycle-Event fire-and-forget (Latency wichtiger als Crash-Safety)
      auditLog.record('session.create', {
        ...auditLog.extractRequestMeta(req),
        session: sessionName,
        directory: dir,
        command: cmd,
      });
```

- [ ] **Step 6.2: `session.delete` in `DELETE /api/sessions/:name`**

Grep nach `app.delete('/api/sessions/:name'`. Der Handler killt die tmux-Session und entfernt sie aus `knownSessions`. Direkt vor dem success-`res.json(...)`:

```javascript
  auditLog.record('session.delete', {
    ...auditLog.extractRequestMeta(req),
    session: name,
  });
```

- [ ] **Step 6.3: `session.rename` in `PATCH /api/sessions/:name`**

Grep nach `app.patch('/api/sessions/:name'`. Der Handler ruft tmux rename-session + `knownSessions.rename`. Direkt vor dem success-`res.json(...)`:

```javascript
  auditLog.record('session.rename', {
    ...auditLog.extractRequestMeta(req),
    oldName: name,
    newName,
  });
```

- [ ] **Step 6.4: `session.attach` + `session.detach` im Terminal-WS-Handler**

Grep nach `app.ws('/api/terminal/:name'`. Der Handler spawnt die pty und wired die Events (`pty.onExit` schließt den WS, der WS-`close`-Handler cleant auf). Wir müssen an drei Punkten editieren: (a) nach erfolgreichem pty-Spawn `attach` loggen + Helper für `detach` definieren, (b) im `pty.onExit`-Handler `detach` loggen, (c) im `ws.on('close')`-Handler `detach` loggen.

**Warum ein dedup-Flag?** Beide Cleanup-Pfade (pty-exit + ws-close) können feuern — oft triggert der eine den anderen (pty.onExit schließt den WS → ws.close feuert). Wir wollen aber nur EIN `session.detach`-Event pro Session. Ein lokaler `detachRecorded`-Flag stoppt den zweiten Aufruf.

**Warum `sessionMeta` cachen?** `req.headers` ist im Async-Closure der Handler noch erreichbar, aber sauberer ist es einmal zu extrahieren. Die Meta-Daten ändern sich während der WS-Session nicht.

**Edit (a):** Direkt nach der Zeile `activePtys.add(pty);` (ungefähr Zeile 1161 im Original) füge ein:

```javascript
  // ── Audit-Log: session.attach + session.detach ────────────────
  // sessionMeta einmal extrahieren und über die WS-Lifetime cachen,
  // damit die async cleanup-Handler keinen req-Closure-Zugriff brauchen.
  // detachRecorded dedupliziert den Dual-Trigger (pty.onExit feuert
  // meist direkt den ws.close, der dann auch recordDetach rufen will).
  const sessionMeta = auditLog.extractRequestMeta(req);
  const attachedAt = Date.now();
  let detachRecorded = false;
  const recordDetach = () => {
    if (detachRecorded) return;
    detachRecorded = true;
    auditLog.record('session.detach', {
      ...sessionMeta,
      session: sessionName,
      durationMs: Date.now() - attachedAt,
    });
  };
  auditLog.record('session.attach', { ...sessionMeta, session: sessionName });
```

**Edit (b):** Finde den existierenden `pty.onExit(...)`-Handler im selben WS-Handler. Er enthält `activePtys.delete(pty)` und `ws.close()`. Füge **direkt vor** dem `ws.close()`-Call die Zeile `recordDetach();` ein:

```javascript
  pty.onExit(() => {
    activePtys.delete(pty);
    recordDetach();
    try { ws.close(); } catch {}
  });
```

**Edit (c):** Finde den existierenden `ws.on('close', ...)` oder `ws.on('message', ...)` Block. Falls es einen expliziten `ws.on('close', ...)` gibt, füge dort `recordDetach();` als erste Zeile ein. Falls es **keinen** expliziten `close`-Handler gibt (Cleanup ist alles in `pty.onExit`), dann füge einen neuen hinzu **nach** dem `pty.onExit`-Handler:

```javascript
  ws.on('close', () => {
    recordDetach();
  });
```

**Warum nicht einen einzigen Edit?** Das Dual-Trigger-Muster braucht beide Stellen: wenn tmux die Session killt → `pty.onExit` feuert zuerst. Wenn der User den Browser-Tab schließt → `ws.on('close')` feuert zuerst. Beide müssen `recordDetach` rufen, der Flag verhindert das Doppel-Event.

- [ ] **Step 6.5: LaunchAgent restart + End-to-End Smoke-Test**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub && sleep 1
AUTH=$(grep ^AUTH_TOKEN .env | cut -d= -f2)

# Session erstellen
curl -s -X POST http://localhost:3333/api/sessions \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"name":"audit-test","directory":"/Users/rocky","command":"sh"}' > /dev/null

# Kurze Pause damit tmux stabilisiert
sleep 1

# Rename
curl -s -X PATCH http://localhost:3333/api/sessions/cc-audit-test \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"newName":"audit-test2"}' > /dev/null

sleep 1

# Delete
curl -s -X DELETE http://localhost:3333/api/sessions/cc-audit-test2 \
  -H "Authorization: Bearer $AUTH" > /dev/null

# Letzte 10 Zeilen des Audit-Logs
tail -10 ~/.claude-code-hub/audit.log | python3 -c "import sys, json; [print(json.loads(l)['event']) for l in sys.stdin]"
```

Expected-Output enthält mindestens:
```
session.create
session.rename
session.delete
```

(attach/detach nur wenn ein Terminal-WS-Connect passiert, was ohne Browser schwierig zu triggern ist — das ist OK.)

- [ ] **Step 6.6: Commit**

```bash
git add server.js && git commit -m "$(cat <<'EOF'
remote-sec: server.js — audit-log events an Session-Lifecycle-Sites

Fünf neue auditLog.record-Calls:
- session.create in POST /api/sessions (fire-and-forget)
- session.delete in DELETE /api/sessions/:name (fire-and-forget)
- session.rename in PATCH /api/sessions/:name (fire-and-forget)
- session.attach im Terminal-WS-Handler direkt nach pty.spawn
- session.detach via dedupliziertem recordDetach helper, getriggert
  von pty.onExit und ws.on('close') (dual-trigger deduplication
  via detachRecorded-Flag)

sessionMeta wird einmal oben aus req extrahiert und gecacht, damit
die async cleanup-Handler nicht auf req zugreifen müssen.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `.env.example` + Rollout-Dokumentation

**Files:**
- Modify: `.env.example`

**Kontext:** Die neuen Config-Variablen müssen im Template dokumentiert sein, damit `setup.sh` und neue Deployments sie auf dem Schirm haben.

- [ ] **Step 7.1: `.env.example` erweitern**

Grep nach `VAPID_SUBJECT` in `.env.example`. Direkt darunter füge hinzu:

```bash

# Cloudflare Access JWT-Validation (optional). Leer lassen = disabled,
# Server läuft im Bearer-only-Modus (wie v0.4.0 und früher). Beide
# gesetzt = secureMiddleware fordert zusätzlich ein gültiges JWT von
# Cf-Access-Jwt-Assertion-Header auf Tunnel-Requests (erkannt an Cf-Ray).
# Team-Domain und Application-Audience-Tag kommen aus dem Cloudflare-
# Zero-Trust-Dashboard (Access → Applications → <deine-App>).
CF_ACCESS_TEAM_DOMAIN=
CF_ACCESS_AUD=
```

- [ ] **Step 7.2: Smoke-Test .env.example parse**

```bash
grep -c '=' .env.example
```

Expected: Zahl erhöht um genau 2 (die beiden neuen Vars).

- [ ] **Step 7.3: Commit**

```bash
git add .env.example && git commit -m "$(cat <<'EOF'
remote-sec: .env.example — CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD

Beide leer gelassen = JWT-Validation disabled (Dev-Mode). Kommentar
erklärt den Rollout-Flow und wo die Werte im Cloudflare-Dashboard
zu finden sind.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Step F.1: Alle 7 Commits im Log**

```bash
cd /Users/rocky/Projects/claude-code-hub && git log --oneline -10
```

Expected: die sieben `remote-sec:` Commits aus Task 1–7 liegen auf `v0.5.0`.

- [ ] **Step F.2: Dev-Mode End-to-End**

Mit `CF_ACCESS_*` weiterhin leer:

```bash
AUTH=$(grep ^AUTH_TOKEN .env | cut -d= -f2)
# Read-Poll
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/api/sessions -H "Authorization: Bearer $AUTH"
# Bad bearer
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/api/sessions -H "Authorization: Bearer wrong"
# Fake Cf-Ray + good bearer (no JWT) — sollte als Tunnel-Request interpretiert werden,
# aber weil cfAccess.isEnabled()=false im Dev-Mode, überspringt der Check die JWT-Validation
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/api/sessions \
  -H "Authorization: Bearer $AUTH" \
  -H "Cf-Ray: fake-dev-mode-test"
```

Expected: `200`, `401`, `200`. Im Dev-Mode bleibt Cf-Ray ohne Wirkung.

- [ ] **Step F.3: Audit-Log hat alle Events**

```bash
cat ~/.claude-code-hub/audit.log | python3 -c "
import sys, json
events = {}
for line in sys.stdin:
    try:
        e = json.loads(line)['event']
        events[e] = events.get(e, 0) + 1
    except: pass
for k, v in sorted(events.items()):
    print(f'{v:5d} {k}')
"
```

Expected: mindestens die Events `auth.fail`, `rate-limit.exceeded`, `session.create`, `session.delete`, `session.rename` haben positive Counts aus den Smoke-Tests.

- [ ] **Step F.4: Cloudflare Access Rollout-Test (manuell, nicht automatisierbar)**

Dieser Test braucht menschliche Hände + Cloudflare-Dashboard-Zugriff:

1. Auf Cloudflare Zero-Trust-Dashboard: `Access → Applications → Add Application → Self-hosted`.
   - Application name: `Claude Code Hub`
   - Session Duration: `24 hours`
   - Application domain: `code.derremo.xyz`
2. Policy anlegen: `Action = Allow`, Include = `Emails: remo.adams@baliet.de` und `GitHub: DerRemo` (beide OR).
3. Application speichern → **Audience Tag notieren** (32-char hex string).
4. `.env` setzen:
   ```
   CF_ACCESS_TEAM_DOMAIN=derremo.cloudflareaccess.com
   CF_ACCESS_AUD=<tag-aus-schritt-3>
   ```
5. `launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub`
6. `logs/stderr.log` tail: kein JWKS-Fetch-Fehler.
7. Browser auf `https://code.derremo.xyz` öffnen → GitHub-Login oder PIN-Flow erscheinen → durchklicken → Hub lädt normal.
8. `audit.log` prüfen: `auth.login`-Event mit `user: remo.adams@baliet.de` ist da.
9. **Spoof-Block-Verification:** Direkt auf dem Mac:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/api/sessions \
     -H "Authorization: Bearer $AUTH" \
     -H "Cf-Ray: fake"
   ```
   Expected: `401` (weil cfAccess jetzt enabled ist, fake Cf-Ray bedeutet „Tunnel-Request", JWT ist aber nicht da → bad-jwt → 401). Audit-Log bekommt `auth.fail:bad-jwt:no-jwt`.

- [ ] **Step F.5: Merge + Release**

Dieser Task kommt später als Teil des v0.5.0-Release-Flows (Task 20 in der übergeordneten TaskList). Hier nur dokumentiert als Abschluss.

---

## Rollback

Falls eines der Task-Ergebnisse Regressions zeigt:

```bash
git log --oneline main..HEAD  # finde den commit
git revert <sha>
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

Dev-Mode-Rollback bei Cloudflare-Access-Problemen: einfach `CF_ACCESS_TEAM_DOMAIN` und `CF_ACCESS_AUD` in `.env` leeren und restart. Kein Code-Revert nötig — die Feature ist komplett Env-gated.
