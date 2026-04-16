# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Claude Code Hub

Web-Interface zum Verwalten und Fernsteuern von Claude Code Sessions auf macOS (Apple Silicon + Intel).

## Projektstruktur

```
claude-code-hub/
├── server.js            # Express + WebSocket Backend (node-pty, tmux)
├── public/
│   ├── index.html       # Single-Page Frontend (Vanilla JS, xterm.js, inline CSS)
│   └── fonts/           # Lokal gehostete Webfonts (JetBrains Mono + Noto Sans Symbols)
├── package.json         # Dependencies: express, express-ws, node-pty, dotenv
├── .env                 # Konfiguration (PORT, AUTH_TOKEN, SESSION_PREFIX, DEFAULT_PROJECT_DIR, TMUX_PATH)
├── .env.example         # Template
├── setup.sh             # Installationsscript (LaunchAgent, .env, npm install)
├── logs/                # stdout.log, stderr.log
├── ROADMAP.md           # Roadmap (Released / In Entwicklung / Backlog / Changelog)
└── CLAUDE.md
```

## Roadmap / Planung

`ROADMAP.md` im Projekt-Root ist das **lebende Roadmap-Dokument** und wird seit 2026-04-13 über die Projekt-Verwaltung im Hub selbst gepflegt (dogfood). Struktur folgt dem `lib/roadmap.js`-Parser:

- **`## Released: vX.Y.Z`** — was aktuell live ist (letztes Release).
- **`## In Entwicklung: vA.B.C`** — woran gerade gearbeitet wird.
- **`## Backlog / Ideen`** — alles was P0/P1/P2-Priorität hat oder als offene Entscheidung ansteht. Items tragen `{priority: p0|p1|p2, theme: …}` oder `{type: decision}` als Meta-Suffix.
- **`## Changelog`** — Narrative pro geshiptem Release, freies Markdown.

Vor neuer Feature-Arbeit: erst `ROADMAP.md` lesen (oder im Hub unter Projekte → claude-code-hub öffnen), schauen ob das Feature schon spezifiziert ist, und bei Änderungen der Planung die Datei mitpflegen. Items werden direkt im Hub-Detail-View getoggelt/ergänzt (`PATCH /api/projects/:id/items`). Nach Abschluss eines Features: Checkbox abhaken und im Changelog des jeweiligen Releases vermerken.

**Parser-Regeln beim manuellen Editieren:** nur Top-Level-Checkboxen (keine Indents), keine `{}` im Item-Text (kollidiert mit Meta-Suffix), keine Control-Chars. Änderungen via Hub sind parser-safe validiert.

## Architektur

- **Backend:** Express.js Server (default Port 3333, konfigurierbar via `PORT` in `.env`). REST-API für Session-CRUD, WebSocket-Endpunkt für Terminal-Zugriff via node-pty. ES Modules (`"type": "module"`). Verwendet durchgehend `execFileSync` mit Argv-Arrays — kein Shell-Interpolation, kein Injection-Risiko.
- **Frontend:** Single HTML-Datei (`public/index.html`) mit eingebettetem CSS/JS. Dashboard mit Session-Cards + Terminal-View mit xterm.js. Kein Build-Step, keine Frameworks, kein clientseitiges Routing — Express fällt alle nicht-API-Routen auf `index.html` zurück.
- **Sessions:** tmux-Sessions mit Prefix `cc-`. Jede Session startet einen Befehl (default: `claude`) in einem Projektverzeichnis. Das Backend hält keinen eigenen Session-State — tmux ist die Source of Truth. `GET /api/sessions` ruft `tmux list-sessions` + `tmux capture-pane` pro Session auf, Previews werden 2 Sekunden lang gecached.
- **Auth:** Bearer-Token aus `.env`. Frontend holt sich den Token beim ersten Laden per `prompt()` und speichert ihn im `localStorage` unter `cchub_token` — der Token steht **nicht** im HTML-Quelltext. REST akzeptiert `Authorization: Bearer <token>`; WebSocket akzeptiert Token per `Sec-WebSocket-Protocol: bearer.<token>` (mit `?token=` als Fallback für die Migration).
- **Remote-Zugriff:** Optional via Cloudflare Tunnel auf eine eigene Domain → `localhost:<PORT>`.
- **Auto-Start:** macOS LaunchAgent (default: `com.claude-code-hub`, konfigurierbar via `LAUNCHAGENT_ID` Env). Siehe `setup.sh` für plist-Template.
- **Graceful Shutdown:** Beim `SIGTERM`/`SIGINT` werden alle aktiven PTYs gekillt bevor der Server schließt.

## Filebrowser (v0.6.0)

### lib/files.js

Zentrales File-I/O-Modul. Jede öffentliche Funktion geht zuerst durch `resolveSafe(projectDir, relPath)` — den **Path-Guard**: resolves den Pfad absolut und prüft dass er unter `projectDir` liegt (403 wenn nicht). Keine Ausnahmen, kein Escape via `../`. Funktionen:

- `listDir(dir, rel)` — Verzeichnisinhalt mit Typ, Größe, mtime
- `readFile(dir, rel)` — Text (≤2MB), Image (≤10MB, base64), PDF (≤10MB, base64), mime-sniffing via `file-type` + Extension-Fallback. Oversize liefert 413 + Metadaten.
- `mkdirSafe(dir, rel)` — `mkdir -p` unter Path-Guard
- `renameOrMove(dir, src, dst)` — atomic rename, beides unter Path-Guard
- `copyFile(dir, src, dst)` — `fs.cp` mit Path-Guard auf beide Seiten
- `writeStream(dir, rel, stream)` — Streaming-Write für Busboy-Uploads, self-write-Suppression via `noteSelfWrite`
- `deleteToTrash(dir, rel)` — ruft `/usr/bin/trash` auf (nicht `rm`, nicht osascript — macOS-Automation-Permission war geblockt)

### lib/file-watcher.js

Rekursives `fs.watch` pro Projekt, on-demand: `attachWatcher(projectDir)` / `detachWatcher(projectDir)`. 30s Idle-Timeout wenn kein Subscriber mehr. 80ms Debounce pro Projekt coalesct Event-Bursts. Self-Write-Suppression: `noteSelfWrite(path)` setzt eine 400ms-TTL; Events innerhalb des Fensters werden gedroppt (verhindert Echo des eigenen Uploads). Gibt Events an `lib/attention.js`-ähnlichen Broadcast weiter via `onFileEvent(cb)`.

### REST-Routen (Filebrowser)

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/projects/:id/files` | Verzeichnis-Listing (`?path=rel`) |
| GET | `/api/projects/:id/files/read` | Datei lesen (`?path=rel`) — Text/Image/PDF/Oversize |
| POST | `/api/projects/:id/files` | Datei erstellen / mkdir (`{ type, path }`) |
| PATCH | `/api/projects/:id/files` | Rename / Move / Copy (`{ op, src, dst }`) |
| DELETE | `/api/projects/:id/files` | In Trash löschen (`?path=rel`) |
| POST | `/api/sessions/:name/upload` | Upload in Session-cwd (Busboy multipart) |
| WS | `/api/files/events` | Live-Updates; `{ type: subscribe/unsubscribe, projectId }` — bearer-Subprotocol wie Terminal |

### Frontend-Module (inline in index.html)

- **`FileBrowser` IIFE** — aufklappbare Sidebar in der Terminal-View, resizable (drag-handle), offene Ordner persistent via `localStorage`. Lazy-Load des Trees: nur beim Aufklappen eines Ordners wird `/api/projects/:id/files?path=rel` gefetcht.
- **`FilePreview`** — Modal für Text/Image/PDF/Oversize. Text-Highlighting via `highlight.js` — lazy per `import()` vom ESM-CDN, nur beim ersten Preview-Open. PDF via `<iframe>` mit Blob-URL, Images inline. Oversize zeigt Metadaten + Download-Hinweis.
- **`FileActions`** — Context-Menu (Rechtsklick im Tree): Öffnen, Umbenennen (inline-Edit), Kopieren, Verschieben, Löschen (2-Klick-Confirm), Pfad kopieren.
- **`Uploader`** — Toast-Stack mit XHR-Fortschrittsbalken, sequenzielle Queue (kein paralleles Flood), Conflict-UI bei 409. Quellen: Tree-DnD (Drop auf Ordner, spring-loaded 600ms Dwell), Terminal-Drop-Overlay (capture-phase Listener vor xterm), Mobile File-Picker-Fallback.

### Tests

- **Unit:** `node --test lib/*.test.js` — deckt `files.js` (path-guard 403, preview 200/413), `file-watcher.js` (debounce, self-write-suppression), upload/cleanup.
- **E2E:** `npm run test:e2e` — Playwright mit zwei Projekten: `chromium` + `webkit-mobile` (iPhone 15 Viewport). 10 Specs pro Engine, 1 fixme pro Engine (synthetic DnD — Playwright input-pipeline löst keine echten OS-Drag-Events aus).

### Scope-Entscheidungen (v0.6.0)

- Nur Projekt-cwd (kein HOME-Zugriff aus dem Filebrowser)
- `/usr/bin/trash` für Delete (kein `rm`, kein osascript Finder)
- Text ≤2MB, Image ≤10MB, PDF ≤10MB; Markdown wird als raw Text geliefert
- Kein Cross-Projekt-Copy in v0.6.0
- Rate-Limit: globaler `writeLimiter` 60/min deckt Uploads (kein per-Route-Bucket)

---

## Hook-basierte State-Detection (Notifications)

Session-Zustand kommt **ausschließlich** aus Claude Code Hooks — kein
Regex-Parser, kein Poll-Loop mehr. Quelle ist `~/.claude/settings.json`,
wo `setup.sh` einen `hooks`-Block installiert, der bei `Stop` / `Notification`
/ `UserPromptSubmit` / `SubagentStop` / `SessionStart` / `SessionEnd` per curl
an `POST /api/hooks/:event` signalisiert. Fremde tmux-Sessions oder Pre-
Hook-Sessions (vor dem Upgrade gestartet) zeigen im Dashboard schlicht
`activity: unknown` → Label „Aktiv".

### Env-Injection

`server.js` injiziert beim `tmux new-session` drei Env-Vars via `-e`, die
als tmux-Session-Env an den Claude-Kindprozess vererbt werden:

- `CC_HUB_SESSION` — tmux-Session-Name (inkl. `cc-`-Prefix)
- `CC_HUB_URL` — `http://127.0.0.1:<PORT>`
- `CC_HUB_TOKEN` — Bearer-Token (nur wenn `AUTH_TOKEN` gesetzt)

### Datenfluss

```
Claude CLI ──Hook──> curl ──POST──> /api/hooks/:event
                                         │
                                         ▼
                            attention.reportHookEvent
                                         │
                                 ┌───────┴───────┐
                                 ▼               ▼
                       session-activity   session-attention
                       (immer, Badge)     (Notifiction-wert)
                                 │               │
                                 ▼               ▼
                            Frontend WS   Frontend WS
                            patchBadge    + Sound/Flash/Unread
```

### Broadcast-Typen (`lib/attention.js`)

- **`session-activity`** — reiner State-Update. Feuert bei JEDEM Hook-Event
  das die activity ändert, auch für attached + muted Sessions. Frontend
  patcht darauf die Badge inline via `patchActivityBadge()`. Payload:
  `{ type, name, activity, at }`.
- **`session-attention`** — Notification-wert. Feuert nur bei `Stop`/
  `Notification`, wenn die Session **unattached + nicht muted** ist und
  der Cool-Down (`HOOK_COOLDOWN_MS = 10s`) abgelaufen ist. Frontend spielt
  Beep, flasht die Card, markiert unread, zeigt Toast. Payload identisch.
- **Cool-Down gilt nur für `session-attention`**, nicht für
  `session-activity` — Badges sollen immer sofort stimmen.

### Event → Activity-Mapping

| Hook-Event        | activity | session-attention? |
|-------------------|----------|--------------------|
| `UserPromptSubmit`| working  | nein               |
| `Stop`            | idle     | ja (wenn unattached) |
| `SubagentStop`    | idle     | ja (wenn unattached) |
| `Notification`    | waiting  | ja (wenn unattached) |
| `SessionStart`    | —        | nein (State-Init)  |
| `SessionEnd`      | —        | nein (purge)       |

### Frische / Stale-Handling

`getHookActivity(name)` liefert null wenn der letzte Hook älter als
`HOOK_FRESH_MS = 60s` ist. `/api/sessions` fällt dann auf `unknown`
zurück — ehrlicher als ein veralteter Wert. Sobald der nächste Hook
kommt, ist der State wieder frisch.

### Rename-Handling

`CC_HUB_SESSION` wird beim `tmux new-session` gesetzt und bleibt im
Claude-Kindprozess auf dem ursprünglichen Namen, auch nach
`tmux rename-session`. Damit spätere Hook-POSTs trotzdem treffen:

- `server.js` hält einen `hookAlias: Map<origName, currentName>`, der bei
  jedem `PATCH /api/sessions/:name` via `aliasOnRename()` nachgezogen wird
  (inkl. Chain: A→B→C bleibt A→C *und* B→C).
- `resolveHookSession(envName)` im Hook-Endpoint löst den Alias auf.
- `attention.rename(old, neu)` verschiebt den State-Eintrag parallel,
  damit `getHookActivity(currentName)` auch nach dem Rename weiterhin
  funktioniert.

### Kaputtes Claude-Hook-JSON

Claude schickt gelegentlich syntaktisch invalides JSON auf stdin (z.B.
`{"line":}`). Die Hook-Route umgeht deshalb den globalen `express.json()`
und nutzt `express.raw()` + try/catch: Payload wird opportunistisch
geparst, bei Fehler als `{}` durchgereicht — der Endpoint wertet das
Payload eh nicht aus.

### Manuelles Unstick (Debugging)

Wenn das Badge in einem kaputten State feststeckt (z.B. durch einen
manuellen Test-POST):

```bash
AUTH=$(grep AUTH_TOKEN .env | cut -d= -f2)
curl -s -X POST "http://localhost:3333/api/hooks/Stop" \
  -H "Authorization: Bearer $AUTH" \
  -H "X-CC-Hub-Session: cc-<name>" \
  -H "Content-Type: application/json" -d '{}'
```

Nach 60s wäre der State ohnehin stale.

### Installation der Hooks in `~/.claude/settings.json`

`setup.sh` Schritt `[5/6]` merged idempotent via `jq` ein `hooks`-Block
pro Event mit Sentinel-Feld `"_owner": "claude-code-hub"`. Re-Runs
ersetzen nur Hub-eigene Einträge, User-eigene Hooks bleiben stehen.
Manueller Re-Install: `setup.sh` erneut laufen lassen.

## API-Endpunkte

| Method | Route | Beschreibung |
|--------|-------|-------------|
| GET | `/api/sessions` | Liste aller tmux-Sessions mit Preview (`?preview=0` deaktiviert N+1-capture) |
| POST | `/api/sessions` | Neue Session erstellen (`{ name, directory, command }`). Name-Whitelist: `/^[\w\-. ]{1,64}$/`. |
| DELETE | `/api/sessions/:name` | Session beenden |
| PATCH | `/api/sessions/:name` | Session umbenennen (`{ newName }`) |
| GET | `/api/browse` | Verzeichnis-Picker (`?path=…&hidden=1`) für UI-Tree. Pfade werden auf `$HOME` eingeschränkt (403 sonst). |
| WS | `/api/terminal/:name` | WebSocket Terminal-Verbindung. Prüft Session-Existenz vor Attach; schließt mit `4004` wenn Session fehlt, `4001` bei Auth-Fehler. |
| POST | `/api/hooks/:event` | Von Claude-Code-Hooks aufgerufen (`Stop`/`Notification`/`UserPromptSubmit`/`SubagentStop`/`SessionStart`/`SessionEnd`). Auth via Bearer-Token, Session-ID über `X-CC-Hub-Session`-Header (aus `CC_HUB_SESSION`-Env). Triggert instant `session-attention`-Broadcast. |

## WebSocket-Protokoll

**Client → Server (Text frames, JSON):**
- `{ "type": "input", "data": "..." }` — Tastatureingabe
- `{ "type": "resize", "cols": N, "rows": N }` — Terminal-Größe ändern

**Server → Client:**
- Binary frames — rohe PTY-Bytes (UTF-8). xterm.js dekodiert chunkboundary-sicher via `term.write(Uint8Array)`.
- Text frame `{ "type": "error", "message": "..." }` — Fehlermeldung vor Close.

**Auth-Handshake:**
Client: `new WebSocket(url, [\`bearer.\${token}\`])`. Server echo'd das Protocol zurück (siehe `wsOptions.handleProtocols` in `server.js`).

## Konventionen

- Sprache im UI: Deutsch
- Design: Dark Theme, Teal-Akzent (#2dd4bf), JetBrains Mono für Code, DM Sans für UI
- Session-Namen bekommen automatisch den Prefix `cc-` (auch beim Rename)
- Session-Name-Whitelist: `^[\w\-. ]{1,64}$`. Verletzungen liefern 400.
- Alle tmux-Aufrufe gehen durch `execFileSync(TMUX, [argv...])` — **nie** Shell-String-Interpolation. Bei Erweiterungen dasselbe Muster nutzen.
- Frontend ist eine Single-File SPA — CSS und JS inline in index.html, kein Build-Step
- xterm.js, xterm-addon-fit und xterm-addon-web-links werden per CDN geladen; JetBrains Mono + Noto Sans Symbols liegen lokal in `public/fonts/`
- Fehlertexte im UI sind Deutsch, API-Error-Strings Englisch — bewusste Trennung zwischen User- und Dev-Ebene.

## Entwicklung

Kein Build-Step, kein Linter. Unit-Tests via `node:test`, E2E via Playwright. Änderungen werden durch Neustart des Servers und Browser-Test / E2E-Run verifiziert.

```bash
# Server manuell starten (zum Testen)
npm start                                        # = node server.js
npm run dev                                      # identisch — kein Watcher/Hot-Reload

# Unit-Tests (lib/*.test.js)
node --test lib/*.test.js

# E2E-Tests (Playwright — Chromium + WebKit-Mobile)
npm run test:e2e                                 # beide Projekte
npm run test:e2e -- --project=chromium           # nur Desktop
npm run test:e2e -- --project=webkit-mobile      # nur iOS-Viewport
npm run test:e2e:ui                              # interaktiver Playwright-UI-Mode

# LaunchAgent neustarten (nach Code-Änderungen nötig, sonst läuft alte Version weiter)
launchctl kickstart -k gui/$(id -u)/com.claude-code-hub

# LaunchAgent stoppen (nötig vor manuellem `npm start`, sonst Port-Konflikt)
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.claude-code-hub.plist

# LaunchAgent erstmalig laden (nach Edit der plist)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude-code-hub.plist

# Logs
tail -f logs/stdout.log
tail -f logs/stderr.log
```

Setup auf frischem Mac: `./setup.sh` (installiert tmux/deps, generiert Token, richtet LaunchAgent ein).

## Usage Dashboard (v0.7.0)

### Datenquellen

Zwei Pipelines speisen das Dashboard:

1. **StatusLine-JSON** — Claude Code sendet bei jedem Status-Line-Render ein JSON-Objekt an `~/.claude/statusline-command.sh`. Das Script rendert die Zeile und sendet per curl ein Subset (rate_limits, cost, context_window, model) an `POST /api/hooks/statusline` (throttled: nur bei Wert-Änderung oder alle 60s). Daraus kommen: Live-Limit-Prozente mit Reset-Countdown, Session-Kosten in USD, Lines Added/Removed, API-Dauer.

2. **JSONL-Analyse** — `lib/usage.js` liest `~/.claude/projects/<mangled-cwd>/*.jsonl` und aggregiert: Token-Verbrauch pro Projekt, Tageszeit-Heatmap (7×24), Tool-Nutzung Top-10, Arbeitsweise (autonome Tool-Ketten vs. direkte Antworten), Cache-Hit-Rate, API-Errors, Sessions pro Tag, geschätzte Kosten.

### lib/usage-limits.js

In-Memory-State pro Session (`Map<sessionName, {...}>`), gespeist von `POST /api/hooks/statusline`. Historisches Limit-Log in `~/.claude-code-hub/usage-limits.jsonl` (append-only, 5MB Rotation, 5min Write-Throttle). Frische-Window: 120s — nach Ablauf gibt `getSessionStatusline()` null zurück.

Funktionen:
- `recordStatusline(name, data)` — In-Memory-State + Log
- `getSessionStatusline(name)` — aktueller State oder null
- `getAllSessionCosts()` — aggregiert über alle frischen Sessions
- `getLimitHistory({days})` — JSONL-Datenpunkte + Peak-Counts
- `rename(old, new)` / `forget(name)` — Lifecycle parallel zu attention.js

### Neue Endpoints

| Method | Route | Beschreibung |
|--------|-------|-------------|
| POST | `/api/hooks/statusline` | StatusLine-Daten empfangen. Auth via Bearer, Session via `X-CC-Hub-Session`. Tolerantes JSON-Parsing. |
| GET | `/api/usage/limits?days=7` | Limit-History + Peaks + aktuelle Werte. 30s-Cache. |
| GET | `/api/usage/costs` | Aggregierte Kosten aus allen aktiven Sessions. 10s-Cache. |

`GET /api/usage/history?days=30` liefert jetzt das erweiterte Payload aus `getDailyUsageV2` (zusätzlich: byProject, heatmap, cacheRate, workStyle, toolUsage, dailySessions, errors).

### Wegfall: tmux capture-pane für Usage

`parseUsagePct5h`, `getSessionPreview` und der Preview-Cache sind entfernt. Session-Enrichment liest Limit-Daten aus dem StatusLine In-Memory-State. Session-Response enthält `limits` (pct5h, pct7d, resets5h, resets7d) und `cost` (totalUsd, durationMs, linesAdded, linesRemoved) statt `usagePct5h`.

### StatusLine-Script

`setup.sh` Schritt `[6/7]` installiert idempotent einen Reporting-Block in `~/.claude/statusline-command.sh` zwischen `#CCH-SL-START#` / `#CCH-SL-END#` Sentinel-Kommentaren. Re-Runs ersetzen nur den Hub-Block, User-Rendering bleibt erhalten.

## Bekannte Einschränkungen

- tmux-Socket wird beim ersten `tmux new-session` automatisch erstellt
- node-pty erfordert Xcode Command Line Tools zum Kompilieren
- `claude` CLI muss im PATH sein. `server.js` ergänzt `~/.local/bin`, `/opt/homebrew/bin` und `/usr/local/bin` zur Laufzeit; der LaunchAgent-PATH selbst bleibt minimal.
- LaunchAgent-plist **muss** Mode `644` haben — launchd verweigert world-writable Dateien stillschweigend mit `Bootstrap failed: 5: Input/output error`. `setup.sh` setzt das automatisch; bei manuellem Edit der plist daran denken.
- tmux muss beim Attach mit `-u` aufgerufen werden, damit es im UTF-8-Mode läuft; außerdem setzt `server.js` `LANG`/`LC_CTYPE` im PTY-Env. Ohne beides ersetzt tmux Multi-Byte-Zeichen (Umlaute, ⏺ ⎿ ✻) durch `_`.
- tmux mouse mode wird beim Server-Start mit `set-option -g mouse on` aktiviert. Ohne das funktioniert Scroll-Wheel im xterm-Terminal nicht, weil tmux keine Wheel-Events an den Client forwarded.
