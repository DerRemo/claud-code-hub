# Remote-Zugriff-Härtung — Design

**Datum:** 2026-04-15
**Scope:** `claude-code-hub` — drei p0-Items aus v0.5.0 in einem kohärenten Security-Layer:
1. Cloudflare Access (Zero Trust) vor dem Tunnel
2. Rate-Limiting auf REST-Endpoints
3. Audit-Log wer wann welche Session attached hat

## Problem

Der Hub hängt aktuell am öffentlichen Cloudflare-Tunnel (`code.derremo.xyz`) und ist nur durch einen statischen Bearer-Token in `.env` geschützt. Drei Schwachstellen:

1. **Einzige Auth-Schicht.** Bei Token-Leak (z.B. `.env` landet in einem Backup der nach außen geht, `ps`-Env zeigt Token, fehlgeschlagenes `journalctl`-Redaction) ist der ganze Hub offen.
2. **Keine Rate-Begrenzung.** Brute-Force gegen den Bearer-Token ist nicht ratenbegrenzt. Ein Runaway-Client (z.B. zombie Browser-Tab mit hängendem Polling) kann die CPU mit execFile-Calls saturieren.
3. **Keine Nachvollziehbarkeit.** Wenn irgendwas komisch wirkt („warum ist die Session gekilled worden?"), gibt's keine Log-Quelle. `console.log`-Output im stdout-Log ist ein Request-Log, kein Event-Log.

## Root-Cause

Der Hub startete als reines Personal-Tool auf einem isolierten LAN und wurde später remote-erreichbar gemacht, ohne dass die Sicherheitsanforderungen mit hochgezogen wurden. Die Infrastruktur (Cloudflare Tunnel, GitHub-Account, iOS-Safari) ist alles da — fehlt nur die Konfiguration und die Middleware-Schicht die sie im Hub-Prozess wirksam macht.

## Design

Drei neue Module in `lib/`, jeweils mit einer klaren Zuständigkeit und minimaler Schnittstelle. Verdrahtung in `server.js`. Keine Änderung am bestehenden Bearer-Check — der wird erweitert statt ersetzt. Alle drei Items teilen sich einen einzigen Request-Kontext-Decorator, damit Audit-Log-Felder und Rate-Limit-Keys konsistent extrahiert werden.

### Modul 1 — `lib/cf-access.js`

Lädt Cloudflare Access JWKS, cached sie, verifiziert eingehende `Cf-Access-Jwt-Assertion`-Header.

**Config (neue Env-Variablen in `.env`):**
```
CF_ACCESS_TEAM_DOMAIN=derremo.cloudflareaccess.com
CF_ACCESS_AUD=<application-audience-tag-aus-cloudflare-dashboard>
```

Beide leer/unset → JWT-Validation disabled, Server läuft im bisherigen Bearer-only-Modus. Erlaubt lokale Entwicklung ohne Cloudflare-Setup und macht den Rollout per-Deploy (Env setzen → Feature aktiv).

**JWKS-Cache:**
- Beim ersten Call: fetch `https://${CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs` → JSON mit `{keys: [{kid, kty, alg, n, e, ...}]}`.
- In-memory `Map<kid, CryptoKey>` + `lastFetchedAt`-Timestamp.
- Refresh-Trigger: (a) `lastFetchedAt` älter als 1h, (b) eingehender JWT hat `kid` der nicht in der Map ist (Cloudflare hat rotiert).
- Fehlschläge werden nicht gecached — jeder Fehler wird propagiert und beim nächsten Call wird erneut versucht.

**JWT-Verify-Flow:**
```
verifyJwtFromRequest(req):
  raw = req.headers['cf-access-jwt-assertion']
  if (!raw) throw InvalidJwtError('no-jwt')
  // jose.jwtVerify macht: header parsen, kid in JWKS finden,
  // RS256-Signatur verifizieren, aud/exp validieren
  const { payload } = await jose.jwtVerify(raw, jwks, {
    audience: CF_ACCESS_AUD,
    // iss wird nicht separat geprüft — jose validiert das indirekt via JWKS-URL
  })
  if (!payload.email) throw InvalidJwtError('no-email')
  return { email: payload.email, sub: payload.sub }
```

Machine-lesbare Error-Gründe: `no-jwt`, `bad-sig`, `expired`, `bad-aud`, `no-email`.

**Dependency:** `jose` (de-facto Standard für JWT+JWKS in Node, ~90kB unpacked, Zero-Dep). Alternative wäre Hand-Rolling mit Node's `crypto.createVerify` — ~50 Zeilen, aber klassisches „lieber Library als Crypto selbst schreiben"-Szenario, und Cloudflare Access verifier-Code circuliert oft falsch.

### Modul 2 — `lib/rate-limit.js`

In-memory Fixed-Window-Counter als Express-Middleware-Factory.

**API:**
```js
export function createRateLimiter({ bucket, max, windowMs, keyFn })
  → ExpressMiddleware
```

**Key-Function-Default:** IP aus `Cf-Connecting-Ip`-Header (von Cloudflare gesetzt), Fallback `req.ip` (für Localhost-Traffic ohne Cloudflare-Header).

**State:** `Map<key, { count, windowStart }>`. Beim Check wird geprüft ob das Window abgelaufen ist (`now - windowStart >= windowMs`) — wenn ja, neuer Eintrag mit `count: 1`. Sonst `count++`. Keine separaten Cleanup-Timer — stale Einträge werden überschrieben sobald dieselbe IP wieder reinkommt, und für IPs die nie wieder kommen bleibt der Speicher-Overhead klein (ein paar hundert Bytes pro Eintrag).

**Response bei Überschreitung:**
- HTTP 429
- Header `Retry-After: <seconds>` (Zeit bis Window-Ende)
- JSON body `{error: 'Rate limit exceeded', retryAfter: <seconds>}`
- Audit-Log-Event `rate-limit.exceeded` mit `{bucket, max, windowMs, ...requestMeta}`

**Wire-up in `server.js`:**
```js
import { createRateLimiter } from './lib/rate-limit.js';
const readLimiter  = createRateLimiter({ bucket: 'read',  max: 300, windowMs: 60_000 });
const writeLimiter = createRateLimiter({ bucket: 'write', max:  60, windowMs: 60_000 });

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/hooks/')) return next();            // Hooks exempt
  if (req.method === 'GET' || req.method === 'HEAD') return readLimiter(req, res, next);
  return writeLimiter(req, res, next);
});
```

**Exempt Endpoints:**
- `/api/hooks/*` — Claude-Code-Hooks können in heißen Sessions hohe Raten feuern (`UserPromptSubmit` pro Keystroke während Live-Streaming). Rate-Limiting würde legitime Events droppen.
- `/healthz` — außerhalb `/api/*`, schon per Middleware-Scope ausgenommen. Cloudflare-Tunnel-Monitoring pollt diesen Endpoint regelmäßig.

**WebSocket:** Der Terminal-WS (`/api/terminal/:name`) ist **eine** persistente Verbindung, nicht pro Request ratenbegrenzt. Der Initial-Handshake geht durch den HTTP-Path und zählt im Write-Bucket. Keine separate WS-Rate-Limit-Logik.

**Konkrete Werte (basierend auf erwartetem Traffic):**
- Read-Bucket: **300 req / 60 s per IP**. Single-User mit 2-3 offenen Tabs, 5s-Polling pro Tab = ~36 req/min. Puffer für spikey Interaktionen.
- Write-Bucket: **60 req / 60 s per IP**. Normale Mutationen (Create/Delete/Pin/Mute) liegen unter 10/min.

### Modul 3 — `lib/audit-log.js`

Append-only JSONL-Writer mit Size-basierter Rotation.

**Storage:**
- `~/.claude-code-hub/audit.log` (aktiv)
- `~/.claude-code-hub/audit.log.1`, `.2`, `.3` (Archive)
- `MAX_SIZE_BYTES = 10 * 1024 * 1024` (10 MB) — ~50.000 Events bei 200 Byte/Event
- `MAX_ARCHIVES = 3`

**Event-Shape:**
```json
{
  "ts": "2026-04-15T12:34:56.789Z",
  "event": "session.attach",
  "user": "remo.adams@baliet.de",
  "ip": "1.2.3.4",
  "cfRay": "abc123-FRA",
  "userAgent": "Mozilla/5.0 (iPhone; ...)",
  "session": "cc-kalvo-feature"
}
```

**API:**
```js
export async function record(event, fields = {})   // serialisiert via saveQueue
export function extractRequestMeta(req)            // → {user, ip, cfRay, userAgent}
```

**Rotation:** Vor jedem Append prüft `maybeRotate(incomingBytes)` einen in-memory `cachedSize`-Wert. Bei Cold-Start wird der Wert einmal per `fs.stat` initialisiert. Wenn das Limit überschritten wird, werden die Archive sequenziell hochnummeriert (`.2 → .3`, `.1 → .2`, aktiv → `.1`) und das neueste Archiv nach Rotation ist leer. `fs.rename` ist atomar — bei Crash während der Rotation bleibt kein halber Stand.

**Concurrency:** `record()` serialisiert alle Calls durch eine Promise-Chain (`saveQueue = saveQueue.then(doWrite)`) — identisches Muster wie in `lib/known-sessions.js`. Damit sind Rotationen und parallele Writes race-frei.

**Crash-Safety:** `fs.appendFile` ist atomar für Writes ≤ `PIPE_BUF` (4096 Bytes auf macOS). Unsere Records sind ~200-500 Bytes. Bei Prozess-Crash mitten im Write bleibt höchstens eine unvollständige Zeile — `jq` würde die überspringen, sonst bleibt die Datei konsistent.

**Events die geschrieben werden:**

| Event | Trigger | Specific fields |
|---|---|---|
| `auth.login` | Erste erfolgreiche JWT-Validation einer Access-Session (erkannt via `lastSeenIat[email]`) | — |
| `auth.fail` | 401 im secureMiddleware | `reason: 'bad-bearer' \| 'bad-jwt' \| 'no-token'` |
| `session.create` | `POST /api/sessions` success | `session`, `directory`, `command` |
| `session.delete` | `DELETE /api/sessions/:name` success | `session` |
| `session.rename` | `PATCH /api/sessions/:name` success | `oldName`, `newName` |
| `session.attach` | Terminal-WS `/api/terminal/:name` handshake erfolgreich | `session` |
| `session.detach` | Terminal-WS schließt | `session`, `durationMs` |
| `rate-limit.exceeded` | Rate-Limiter feuert 429 | `bucket`, `max`, `windowMs` |

**Await-Strategie:** Security-Events (`auth.fail`, `auth.login`, `session.attach`, `rate-limit.exceeded`) werden `await`ed, damit sie bei Crash garantiert auf Disk sind. Lifecycle-Events (`session.create/delete/rename`, `session.detach`) werden fire-and-forget aufgerufen, weil sie latency-sensitiv in den Request-Handler integrieren und ein gelegentlicher Verlust bei Crash akzeptabel ist. Kommentiert im Code.

**Hooks-Endpoints:** Die `/api/hooks/*`-Route wird **nicht** ins Audit-Log geschrieben. Hooks sind keine User-Aktionen — sie sind automatische Background-Events von Claude-Code. Audit-Log bleibt auf Benutzer-initiierte Events fokussiert.

### Integration — der neue `secureMiddleware`

Der existierende `authMiddleware` wird zu `secureMiddleware` umgebaut. Logik:

```js
async function secureMiddleware(req, res, next) {
  const meta = auditLog.extractRequestMeta(req);
  const fromTunnel = !!req.headers['cf-ray'];

  // 1. JWT-Check (nur bei Tunnel-Traffic UND wenn CF_ACCESS_* konfiguriert)
  if (fromTunnel && cfAccess.isEnabled()) {
    try {
      const { email } = await cfAccess.verifyJwtFromRequest(req);
      req.cchContext = { ...meta, user: email };

      // Detect new Access-Session via iat-Map → fire auth.login once
      if (cfAccess.isNewLoginIat(email, req)) {
        await auditLog.record('auth.login', { ...meta, user: email });
      }
    } catch (e) {
      await auditLog.record('auth.fail', { ...meta, reason: `bad-jwt:${e.code || 'unknown'}` });
      return res.status(401).json({ error: 'Unauthorized (JWT)' });
    }
  } else {
    req.cchContext = { ...meta, user: null };
  }

  // 2. Bearer-Check (immer, unabhängig von JWT)
  if (AUTH_TOKEN) {
    const token = extractToken(req);
    if (token !== AUTH_TOKEN) {
      await auditLog.record('auth.fail', { ...meta, reason: 'bad-bearer' });
      return res.status(401).json({ error: 'Unauthorized (token)' });
    }
  }

  next();
}
```

**Reihenfolge in `server.js`:**
```js
app.use('/api', secureMiddleware);     // Auth first
app.use('/api', rateLimitDispatcher);  // Dann Rate-Limit (kennt req.cchContext)
// ... dann die Route-Definitionen
```

**Rate-Limit-Dispatcher** ist das kleine Wrapper-Middleware von oben, das zwischen read/write/hooks unterscheidet.

### `Cf-Ray`-basierte Tunnel-Detection

**Der Kern-Security-Punkt:** Wir unterscheiden „Tunnel-Traffic" von „Localhost-Traffic" ausschließlich durch die Präsenz des `Cf-Ray`-Headers. Cloudflared strippt eingehende `Cf-*`-Header vom Client, bevor es sie an den Origin weiterreicht, und setzt seine eigenen. Heißt: ein Tunnel-Request hat **immer** `Cf-Ray`, ein Localhost-Request hat **nie** `Cf-Ray` (außer ein Angreifer setzt ihn manuell).

**Threat-Szenario „Angreifer spooft `Cf-Ray` von Localhost":**
- Angreifer hat Shell-Access auf dem Mac mini.
- Er kann mit `curl -H "Cf-Ray: fake"` direkt localhost:3333 anrufen.
- Unsere Middleware klassifiziert das als Tunnel-Request und fordert JWT.
- Angreifer hat keinen JWT → `auth.fail` + 401.
- Alternativ versucht er ohne `Cf-Ray`-Header → wird als Localhost klassifiziert → braucht nur Bearer → wenn er die `.env` lesen kann, ist er sowieso rein.

Die Eigenschaft `Cf-Ray-Spoof macht's nicht einfacher für den Angreifer` hält. Gut.

**Verifikation bei Implementierung:** Ein Test-Case soll explizit prüfen, dass direkt-curl mit fake `Cf-Ray` **ohne** gültiges JWT mit 401 abgelehnt wird, nicht durchrutscht. Das ist die Kern-Sicherheits-Annahme dieser Architektur.

## Testing

Keine automatisierte Test-Suite im Projekt (per `CLAUDE.md`). Manueller Test-Plan:

1. **Dev-Mode ohne Cloudflare Access:** `CF_ACCESS_TEAM_DOMAIN` und `CF_ACCESS_AUD` leer lassen. Server läuft weiter, Bearer-only. Browser → Dashboard → alles wie bisher. Keine Regression.
2. **JWKS-Laden:** Env setzen, Server starten, `/healthz` pollen um Startup zu prüfen. Log zeigt erfolgreichen JWKS-Fetch. Keine Fehler in `stderr.log`.
3. **Browser via Tunnel mit Access:** Access-Policy auf Cloudflare-Dashboard aktivieren (GitHub + PIN beide). iPhone-Safari auf `code.derremo.xyz` → GitHub-Login-Seite → Code autorisieren → zurück auf den Hub. `audit.log` enthält einen `auth.login`-Eintrag mit `user: remo.adams@…`.
4. **JWT-Spoof-Block:** Lokaler `curl http://localhost:3333/api/sessions -H "Authorization: Bearer $TOKEN" -H "Cf-Ray: fake"` → 401 mit `auth.fail:bad-jwt`-Eintrag im Log.
5. **Localhost-Bypass:** `curl http://localhost:3333/api/sessions -H "Authorization: Bearer $TOKEN"` ohne `Cf-Ray` → 200 (Localhost, nur Bearer geprüft). Keine JWT-Regeln angewendet.
6. **Hooks-Exempt:** Claude feuert Hook → `POST /api/hooks/Stop` mit Bearer, ohne JWT → 200. Kein Audit-Log-Eintrag.
7. **Rate-Limiting Read:** `for i in $(seq 1 305); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/api/sessions -H "Authorization: Bearer $TOKEN"; done | tail -5` → letzte Responses sind 429. `audit.log` bekommt `rate-limit.exceeded`-Eintrag.
8. **Rate-Limiting Write:** Analog mit 65 POST-Requests an `/api/sessions` → 429 nach 60.
9. **Audit-Chain:** Neue Session anlegen → attachen → Back-Button → Session killen. `audit.log` zeigt `session.create`, `session.attach`, `session.detach` (mit `durationMs`), `session.delete` — in dieser Reihenfolge.
10. **Rotation-Smoke-Test:** `MAX_SIZE_BYTES` temporär auf 2048 setzen (code-patch), mehrere Events generieren, sehen dass `audit.log.1` entsteht, dann `.2`, dann `.3`, dann dass `.3` überschrieben/verloren geht. Patch zurückrollen.

## Rollout

Zweistufig:

**Phase A — Dev-Mode (CF_ACCESS_* leer):**
- Code deployen, inklusive neuer Dependency `jose`
- Rate-Limiting aktiv, Audit-Log aktiv, JWT-Validation disabled
- Bestehender Bearer-Auth-Flow unverändert → Zero-Downtime für Browser-User
- Beobachtungszeit: Rate-Limit-Schwellen und Audit-Log-Volumen prüfen

**Phase B — Access-Aktivierung:**
- Auf Cloudflare-Dashboard: neue Access-Application für `code.derremo.xyz` anlegen, Policy = GitHub OR PIN, Session-Duration 24h. Audience-Tag notieren.
- `.env` setzen: `CF_ACCESS_TEAM_DOMAIN=derremo.cloudflareaccess.com`, `CF_ACCESS_AUD=<tag>`
- Server restarten
- Ab sofort: Browser-Zugriff fordert Access-Login, Localhost bleibt Bearer-only

**Rollback:** `.env` wieder leeren → zurück zu Phase A. Code bleibt deployed (JWT-Logic ist idle wenn unset). Im schlimmsten Fall `git revert` auf den Merge-Commit.

## Offene Implementierungs-Details (bei Plan-Erstellung entscheiden)

1. **`await` vs fire-and-forget** pro Audit-Event: im Spec-Text oben als Regel definiert (security-events awaiten, lifecycle-events fire-and-forget). Plan soll es pro Call-Site explizit machen.
2. **`extractRequestMeta` Placement:** entweder als Helper aus `lib/audit-log.js` exportiert, oder als separates `lib/request-context.js`. Im Spec ist es `audit-log.js` — falls es bei der Implementierung zu eng wird, kann der Plan es splitten.
3. **Session-Duration-Tracking bei `session.detach`:** braucht einen `Map<sessionName, attachedAt>` im WS-Handler. Implementation-Detail, Plan soll das klarziehen.
4. **`isNewLoginIat`-Heuristik:** `Map<email, lastIat>` in-memory, bei jedem JWT-Verify vergleichen. Wenn `payload.iat > lastIat` → neuer Login. Memory-only (startet bei Restart neu, dann der allererste JWT jeder Email nach Restart feuert `auth.login`). Akzeptabel.
