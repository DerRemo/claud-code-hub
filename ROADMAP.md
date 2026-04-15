# Claude Code Hub — Roadmap

Stand: 2026-04-13. Lebendes Dokument, gepflegt über die Projekt-Verwaltung
im Hub selbst. Struktur folgt dem `lib/roadmap.js`-Parser:
H2-Sections Released / In Entwicklung / Backlog / Changelog,
Top-Level-Checkboxen mit optionalem `{key: value}`-Meta-Suffix.

## Released: v0.3.0

Projekt-Verwaltung Step 2b (Project-Creation + Live-Sync) und Step 3
(Session-Linking + Release-Flow). Reihenfolge: Prereqs zuerst, dann
Creation, dann Watcher, dann Session-Verknüpfung.

- [x] Re-Read inside mutateRoadmap lock — Prereq fürs Watcher-Race {priority: high, step: 2b}
- [x] mutateRoadmap liefert fresh Roadmap inside-lock zurück {step: 2b}
- [x] Registry als Long-Lived-Singleton refactoren {step: 2b}
- [x] POST /api/projects mit Template-ROADMAP.md {step: 2b}
- [x] Tree-Picker-Integration im New-Project-Modal {step: 2b}
- [x] Discovery-on-Read in GET /api/projects {step: 2b}
- [x] listProjects mit Concurrency-Cap für große Setups {step: 2b}
- [x] fs.watch pro registrierter ROADMAP.md {step: 2b}
- [x] Watcher-Debounce 50-100ms plus Sequenz-IDs {step: 2b}
- [x] WebSocket-Broadcast an offene Detail-Views {step: 2b}
- [x] Registry-Write-Mutex via withFileLock {step: 2b}
- [x] section-not-found sollte 409 statt 400 sein {step: 2b}
- [x] Scroll- und Focus-Preservation beim Re-Render {step: 2b}
- [x] Meta-Pills statt JSON.stringify im Frontend {step: 2b}
- [x] Inline-Input statt prompt und confirm für Add/Delete {step: 2b}
- [x] Themed Success-Variante für project-toast {step: 2b}
- [x] Session-Badge via cwd-Prefix-Match auf Session-Cards {step: 3}
- [x] Projekt-Detail listet offene Sessions im cwd {step: 3}
- [x] Button Session hier starten im Projekt-Detail {step: 3}
- [x] Version-abschliessen-Flow mit Release-Notes-Generator {step: 3}
- [x] Terminal-Quick-Action Idee zu Backlog {step: 3}
- [x] Dashboard-Search matcht auch Roadmap-Items {step: 3}

## In Entwicklung: v0.4.0

Notifications-Theme: Attention-Detection, Sound + Visual, Web-Push,
Telegram — aus dem p0-Backlog nach oben gezogen.

- [x] Notifications: Attention-Detection via tmux capture-pane Parser {priority: p0, theme: notifications}
- [x] Notifications: Hook-basierte State-Detection ersetzt Regex-Parser {priority: p0, theme: notifications}
- [x] Notifications: Regex-Parser-Fallback komplett entfernt Hook-only {priority: p0, theme: notifications}
- [x] Notifications: Per-Session Stummschalten {priority: p0, theme: notifications}
- [x] Notifications: Sound-Alert in der Terminal-View {priority: p0, theme: notifications}
- [x] Web-Push API als zweiter Notification-Kanal neben Telegram {priority: p1, theme: notifications}
- [x] Web-Push Zuverlässigkeits-Fix — Per-Device-Presence statt tmux-attached, VAPID-APNs-Stabilisierung, Diagnose-Logging {priority: p0, theme: notifications}
- [ ] Notifications: Telegram-DM wenn Claude auf Input wartet {priority: p0, theme: notifications}
- [x] Terminal Desktop Copy/Paste — Shift/Alt+Drag kopiert automatisch, Cmd/Ctrl+V fügt ein cross-browser cross-platform {priority: p0, theme: terminal-ux}

## Backlog / Ideen

Alles was bis 2026-04-13 in der alten `todo.md` unter P0/P1/P2 stand und
noch nicht shipped ist. Nach ursprünglicher Priorität und Thema gruppiert.

- [ ] Multi-CLI: CLI-Typ als Session-Metadatum plus Icon im UI {priority: p0, theme: multi-cli}
- [ ] Multi-CLI: Preset-Profile im New-Session-Modal {priority: p0, theme: multi-cli}
- [ ] Multi-CLI: Per-CLI-Auth via .env.cli.name oder profiles-Ordner {priority: p0, theme: multi-cli}
- [ ] Remote-Zugriff: Cloudflare Access (Zero Trust) vor dem Tunnel {priority: p0, theme: security}
- [ ] Remote-Zugriff: Rate-Limiting auf REST-Endpoints {priority: p0, theme: security}
- [ ] Remote-Zugriff: Audit-Log wer hat wann welche Session attached {priority: p0, theme: security}
- [x] Notifications: Badge-Count im Browser-Tab-Titel {priority: p0, theme: notifications}
- [ ] Session-Templates / Favoriten mit vorausgefülltem cwd und Command {priority: p1, theme: sessions}
- [ ] Bulk-Actions: alle idle- oder unattached-Sessions beenden {priority: p1, theme: sessions}
- [ ] Session-Pinning für wichtige Sessions oben sortiert {priority: p1, theme: sessions}
- [ ] Split-View mit zwei Terminals nebeneinander für große Screens {priority: p1, theme: sessions}
- [ ] asciinema-Style Recording plus Replay als cast-Export {priority: p1, theme: sessions}
- [ ] Read-only-Share-Link mit kurzlebigem Token für Live-Debugging {priority: p1, theme: sessions}
- [ ] Git-Status-Widget pro Session — Branch, Dirty, Ahead/Behind {priority: p1, theme: productivity}
- [ ] Filebrowser pro Projekt — Tree-View plus Preview lesen/löschen/kopieren/verschieben/umbenennen {priority: p0, theme: productivity}
- [ ] Offene Frage Filebrowser — Scope (Projekt-cwd oder ganzes HOME), Preview-Formate und Größen-Limit, Löschen via Trash oder rm, Cross-Projekt-Copy, Live-Refresh via fs.watch {type: decision}
- [ ] Datei-Upload per Drag und Drop ins Terminal {priority: p1, theme: productivity}
- [ ] Prompt-Snippet-Library mit Klick-to-paste {priority: p1, theme: productivity}
- [x] /healthz-Endpoint für Cloudflare Tunnel-Monitoring {priority: p1, theme: observability}
- [ ] Structured Logging via pino statt console.log {priority: p1, theme: observability}
- [ ] Basic Metrics: aktive Sessions, Uptime, Reconnect-Count {priority: p1, theme: observability}
- [ ] Web-Client Auto-Reload nach Server-Restart {priority: p1, theme: observability}
- [ ] E2E-Tests als Dauer-Setup mit Playwright {priority: p2, theme: dev-x}
- [ ] ESLint und Prettier auf server.js und inline-JS {priority: p2, theme: dev-x}
- [ ] Docker-Image für Linux/NAS weg von Mac-only {priority: p2, theme: dev-x}
- [ ] Request-Validation via zod oder joi auf POST/PATCH-Bodies {priority: p2, theme: dev-x}
- [ ] GitHub Actions CI mit Lint und Tests auf Push {priority: p2, theme: dev-x}
- [x] CSP-Header gegen XSS-Folgeschäden {priority: p2, theme: security}
- [x] Subresource-Integrity für xterm.js-CDN-Scripts {priority: p2, theme: security}
- [ ] CSRF-Token auf mutierende Endpoints falls Cookie-Auth kommt {priority: p2, theme: security}
- [ ] Token-Rotation per Schedule monatlich {priority: p2, theme: security}
- [ ] /api/browse Allow-List via ENV statt nur HOME {priority: p2, theme: security}
- [x] Offene Frage: welche CLIs neben claude reinsollen — gemini/codex/aider/cursor {type: decision}
- [x] Offene Frage: Hub single-user oder multi-user {type: decision}
- [x] Offene Frage: Notifications-Kanal — Telegram allein oder mit Web-Push/macOS {type: decision}
- [x] Offene Frage: Remote-Access-Weg — Cloudflare Access ODER Tailscale {type: decision}
- [x] Offene Frage: Token-Auth — Bearer bleiben oder Passkey/WebAuthn {type: decision}
- [ ] Item-Auto-Prompt — Klick aufs Roadmap-Item spawnt Session im Projekt-cwd und sendet den Item-Text als ersten Prompt an Claude {theme: session-link}
- [x] Terminal Kontrast in Lightmode nicht gut (weißert text auf weißen hintergrund)
- [x] Ideenfeld leert sich nicht nach senden
- [x] Session übersicht flasht beim aktualisieren
- [ ] iOS App

## Changelog

### v0.3.0 — 2026-04-14

**Projekt-Verwaltung Phase 1 Step 3 — Release-Flow, Search, Idea-Capture.**
Der „Version abschließen"-Flow ist drin: neue Writer-Funktion
`finalizeRelease(content, {releaseVersion, newDevVersion, narrative})`
verschiebt alle „In Entwicklung"-Items in die „Released"-Section,
bumpt beide Versions-Header und prependet einen
`### vX.Y.Z — Datum`-Block in die Changelog-Section. Byte-safe:
findet Section-Boundaries per Regex, operiert bottom-up auf einem
`lines`-Array damit obere Indices während der Mutation stabil
bleiben. Narrative wird gegen eingebettete H2-Header validiert
(würde sonst neue Sections in die Roadmap zaubern). Backend-Wrapper
`releaseProject(id, body)` routet das durch `mutateRoadmap`, neues
Endpoint `POST /api/projects/:id/release`. Frontend-Button
„Version abschließen" in der Detail-Toolbar (nur sichtbar wenn
Dev-Items + Versionen vorhanden) öffnet ein Modal mit Prefill
(Release-Version = aktuelle Dev, neue Dev = `+patch`), Textarea für
die Narrative, und 8 neue Unit-Tests für `finalizeRelease` decken
Happy-Path, fehlende Sections, falsche Reihenfolge, H2-Injection und
ungültige Versions ab.

Dashboard-Suche durchsucht jetzt auch Roadmap-Items. Neues Endpoint
`GET /api/projects/search?q=<query>` liest parallel über `mapLimit`
alle registrierten ROADMAP.md-Dateien, parst sie und filtert
case-insensitive über den Item-Text. Ergebnisse werden nach Section
sortiert (dev → backlog → released) damit frische Ideen zuerst auftauchen.
Frontend: das existierende Such-Input bekommt `data-tab-scope="sessions projects"`
(neue Multi-Tab-CSS-Regel), auf dem Projekte-Tab wird die Query
debounced (200ms) an den Server geschickt und die Treffer erscheinen
als „Roadmap-Treffer"-Block unter der Projekt-Liste. Jeder Treffer
zeigt Section-Pill, markierten Text (`<mark>` auf Query-Substring,
XSS-safe via escape-before-highlight) und Projektname, Klick springt
in die Detail-View.

Terminal-Quick-Action „Idee notieren": neuer Toolbar-Button im
Terminal-View, sichtbar wenn der Session-cwd zu einem registrierten
Projekt gehört (Match über den bestehenden `projectsCache`). Klick
blendet einen Inline-Prompt zwischen Toolbar und xterm ein, Enter
schreibt einen neuen Backlog-Item für das gematchte Projekt via
bestehendem `PATCH /api/projects/:id/items`-Endpoint. Der Button
wird nachgezogen wenn der Projekte-Cache erst während der aktiven
Terminal-Session warm wird.

**Projekt-Verwaltung Phase 1 Step 3 — Session-Linking.**
Session-Cards auf dem Dashboard zeigen jetzt ein Projekt-Badge (das
Phase-0-HTML-Stub wurde aktiviert), wenn der pane-cwd unter dem Pfad
eines registrierten Projekts liegt. Match-Logik: längster passender
Projektpfad gewinnt, Pfad-Grenze korrekt (kein String-Prefix auf
Namensebene), damit verschachtelte Projekte sauber aufgelöst werden.
Klick aufs Badge navigiert in die Projekt-Detail-View. Die Projekt-
Liste wird frontend-seitig gecacht und nur bei WS-`project-changed`-
Events invalidiert, damit das 5s-Session-Polling nicht jedes Mal
`/api/projects` mittrifft.

Im Projekt-Detail-View steht oben ein „Offene Sessions"-Panel, das
alle running/dormant Sessions listet deren cwd unter dem Projektpfad
liegt. Running-Dot ist teal glow, dormant grau; Klick auf eine Zeile
verbindet zum Terminal bzw. restauriert die Session. Die Toolbar
rechts hat einen neuen Button „Session hier starten", der das New-
Session-Modal mit dem Projektpfad vor-ausgewählt öffnet — der Tree-
Picker bekommt dafür einen `setSelected`-Setter, damit Prefill
funktioniert, bevor der initiale Browse-Request zurückkommt.

**Projekt-Verwaltung Phase 1 Step 2b — Creation + Live-Sync.**
Foundation-Refactor, Project-Creation und fs.watch-basierte Live-
Synchronisation. `mutateRoadmap` parst die neue Datei jetzt inside-lock
und gibt die frische Roadmap direkt zurück; `patchProject` braucht
dadurch keinen zweiten Registry- und File-Read mehr und die alte Race
zwischen Write und Re-Read ist weg. Die Registry ist ein Long-Lived-
Singleton mit einem neuen `mutateRegistry`-Helper: Clone+Swap im
`withFileLock` sorgt dafür, dass parallele Reader (`listProjects`,
`getProject`) nie halbgare Mutationen sehen, ein JSON-Compare skippt
No-Op-Writes, damit Discovery-Runs keine überflüssigen fs.watch-Events
auslösen. `listProjects` liest File-Inhalte über einen `mapLimit`-Pool
(8 parallel statt Promise.all-All-at-once), und `GET /api/projects`
triggert opportunistisch `discoverProjects` mit 30s-TTL-Throttle plus
Inflight-Dedupe.

Neuer Endpoint `POST /api/projects` legt ein Projekt an: schreibt eine
Template-ROADMAP.md (mit Parser-Rules-Kommentar im Header als Self-
Documentation für beliebige Claude-Sessions im Projekt), registriert
unter slug-ID mit Kollisions-Suffix, und ist path-gated auf `$HOME`.
Frontend hat dafür ein eigenes New-Project-Modal mit Tree-Picker —
der Tree-Picker wurde zu einer Factory refactored, Session- und
Projekt-Modal haben jetzt unabhängige Instanzen. Nach dem Create wird
direkt in die Detail-View gesprungen; Rückkehr aufs Dashboard lädt die
Projekte-Liste neu, damit das neue Projekt sichtbar wird.

Live-Sync via `lib/project-watcher.js`: ein `fs.watch` pro registrierter
ROADMAP.md mit `syncWatchers(registry)` als idempotentem Attach/Detach-
Hub. macOS-Atomic-Rename (tmp+rename) triggert `rename`-Events die den
Handle stalen; der Watcher schließt und re-öffnet dann mit 50ms-Grace.
Per-Projekt-Debounce (80ms) coalesct Event-Bursts und inkrementiert
eine Sequence-ID, die in jedem Broadcast mitfliegt. `mutateRoadmap`
ruft vor dem Rename `noteSelfWrite(path)` auf — der darauffolgende
Event wird innerhalb 400ms gedroppt, damit ein PATCH-Aufrufer keinen
doppelten Rerender durch seinen eigenen Write erlebt. Neuer WS-Endpoint
`/api/projects/events` fan-outet die Events an alle verbundenen Clients
(Auth via `bearer.<token>`-Subprotocol wie das Terminal). Frontend
öffnet die WS on-demand wenn der Projekte-Tab oder eine Detail-View
sichtbar wird, mit Exponential-Backoff-Reconnect (500ms → 30s cap) und
Seq-Dedupe pro Projekt-ID; bei Match rerendert die Detail-View, sonst
die Liste. Externe ROADMAP.md-Edits (im Terminal, anderem Editor, von
Claude selbst im Projekt-cwd) erscheinen dadurch innerhalb von ~100ms
im Hub, ohne dass der User refreshen muss.

Polish im Detail-View: `section-not-found` ist jetzt 409 (nicht 400) —
konsistent mit `stale`, der Client triggert dadurch einen Refresh
statt einen Error-Toast. Meta-Pills ersetzen den rohen `JSON.stringify`-
Dump: `priority: p0/p1/p2` rot/gelb/grau, `theme` teal, `type: decision`
violett. `showProjectToast` hat jetzt eine `success`-Variante (teal
Border + ✓). Scroll-Position und Focus-Target werden vor jedem Re-Render
gemerkt und per `requestAnimationFrame` restauriert — besonders
wichtig mit Live-Sync, wo die View jetzt öfter neu rendert. `prompt()`
beim Add-Item ist durch einen Inline-Text-Input ersetzt (Enter = save,
Esc/Blur-leer = cancel), Live-Sync-Events werden während des Tippens
gedroppt damit der Input nicht geklobbert wird. `confirm()` beim
Delete ist durch ein 2-Klick-Confirm-Pending-Pattern ersetzt (× → ✓?,
Auto-Revert nach 3s).

**Security Headers + SRI.** CSP-Header als Express-Middleware mit
strikter Whitelist für externe Quellen (`cdn.jsdelivr.net`,
`fonts.googleapis.com`, `fonts.gstatic.com`). `script-src`/`style-src`
behalten `'unsafe-inline'` wegen der Single-File-SPA ohne Build-Step,
aber externe Script-Injection ist gedeckelt. Zusätzlich
`X-Content-Type-Options: nosniff` und `Referrer-Policy: no-referrer`.
Alle vier xterm-CDN-Tags haben jetzt `integrity=sha384-…` plus
`crossorigin="anonymous"` — Tampering am CDN würde den Browser das
Laden verweigern lassen.

**Healthcheck.** Neuer `/healthz`-Endpoint (unauthenticated, außerhalb
`/api`) liefert `{status, uptimeSeconds, sessions, activePtys, version}`
als JSON für Cloudflare-Tunnel-Monitoring. `Cache-Control: no-store`,
und der Request-Logger filtert `/healthz` raus, damit Poll-Traffic die
Logs nicht flutet. Dient gleichzeitig als Startpunkt für das spätere
Metrics-Feature.

**Tab-Titel-Badge.** Wenn eine Session `activity === 'waiting'` meldet
(Konfirm-Dialog oder Menü-Prompt in Claude Code), prefixt der Browser-
Tab-Titel mit `(N) Claude Code Hub`. Wird bei jedem Session-Polling
neu berechnet aus dem Activity-Signal, das schon für die Session-Cards
genutzt wird. Kein zusätzlicher Backend-Call.

**Projekt-Verwaltung Polish (Step 2b, Start).** `section-not-found`
liefert jetzt `409` statt `400` — konsistent mit dem Konflikt-Szenario
bei `stale`, der Client triggert dadurch automatisch einen Refresh
statt einen Error-Toast. Meta-Pills im Detail-View ersetzen den rohen
`JSON.stringify(it.meta)`-Dump: `priority: p0/p1/p2` wird rot/gelb/grau,
`theme` teal, `type: decision` violett, alles andere neutral. Und
`showProjectToast()` nimmt eine zweite Variante `success`, die die
Toast-Border teal einfärbt und einen ✓-Prefix bekommt — aktuell nur
beim Item-Hinzufügen im Einsatz.

### v0.2.0 — 2026-04-13

**Projekt-Verwaltung (Phase 0 + Phase 1 Step 1 + Step 2a).**
Ein neuer Dashboard-Tab "Projekte" mit Liste + Detail-View. Im Detail-View
sind Roadmap-Items jetzt klickbar — toggle, add, delete via `PATCH
/api/projects/:id/items`. Write-Back ist atomar (temp-file + rename)
und serialisiert pro ROADMAP.md via `lib/mutations.js` (Per-File-Mutex).
Der Parser `lib/roadmap.js` und der Writer `lib/roadmap-writer.js` haben
zusammen 61 `node:test`-Cases (byte-for-byte Preservation beim Toggle,
stale-Detection bei Line-Mismatch, Control-Char- und Brace-Validation
auf Text/Meta). Registry + Auto-Discovery liegt unter
`~/.claude-code-hub/projects.json`, Scan-Roots per `PROJECT_ROOTS`-Env
überschreibbar. Frontend nutzt Optimistic-UI mit Revert bei Fehler,
Conflict-Toast bei 409, `.disabled`-Gate gegen Doppel-Klick-Races.

**Mobile-Support.**
PWA-Manifest, Apple-Meta, SVG + PNG-Icons, Home-Screen-fähig mit
standalone-Mode. Touch-Toolbar über der iOS-Tastatur mit Esc/Tab/Ctrl
(sticky), Pfeilen und den üblichen Sondertasten — positioniert sich
via `visualViewport`. Safe-Area-Handling via `env(safe-area-inset-*)`
auf allen relevanten Containern, `viewport-fit=cover` im Meta-Tag.
100dvh ersetzt 100vh überall, zusätzlich `--kb-inset` CSS-Variable für
die iOS-Tastaturhöhe. History-State-basierte Zurück-Navigation (native
iOS-Edge-Swipe und Desktop-Browser-Back funktionieren gleichermaßen).
Touch-Scroll im Terminal wird zu SGR-Mouse-Wheel-Escape-Sequenzen
übersetzt und durch tmux Copy-Mode geroutet. Playwright-Regression mit
29 Mobile-Cases.

**Session-Recovery & Adoption.**
`~/.claude-code-hub/sessions.json` persistiert jede jemals erstellte
oder adoptierte Session (Name, cwd, Command, Timestamps). Atomare
Writes via saveQueue, 60-Sekunden-Heartbeat aktualisiert `lastSeenAt`.
Drei Session-States: `running` (live tmux + cc-Prefix oder known),
`dormant` (known aber tmux-los), `foreign` (tmux ohne cc-Prefix und
nicht known). Drei neue Endpoints: `POST /restore`, `POST /adopt`,
`DELETE /known`. UI rendert drei Sections mit eigenen Card-Varianten:
Ruhende Cards haben Diagonal-Stripe-Overlay und Glow-Restore-Button,
fremde Cards haben Corner-Bracket-Marker und Adopt-Modal mit
Name-Input. Alles über Design-Tokens, Light-Theme funktioniert mit.

**Usage / Token-Tracking.**
Parser `lib/usage.js` liest `~/.claude/projects/<mangled-cwd>/*.jsonl`
direkt (kein Admin-API-Key nötig) mit mtime-basiertem LRU-Cache.
Neuer Dashboard-Tab "Usage" zeigt Monats-Summe als Teal-Header,
Model-Breakdown und 30-Tage-Tabelle. Session-Card zeigt jetzt aktuellen
Context ("143k ctx") statt Window-Count. Endpoint
`GET /api/usage/history?days=N` mit 60-Sekunden-Cache. Polling pausiert
im Usage-Tab, andere Tab-Controls werden per `data-tab-scope` blendgated.

### v0.1.0 — Initial Hub

Grundgerüst des Hubs. Express + express-ws Backend auf Port 3333.
tmux-Sessions mit `cc-`-Prefix als Source of Truth, node-pty als
Terminal-Bridge zum Browser. Vanilla-JS Single-File-Frontend mit
xterm.js, Dashboard mit Session-Cards plus Terminal-View. Bearer-Token-
Auth via `.env`, Remote-Zugriff über Cloudflare Tunnel auf
`code.derremo.xyz`. macOS LaunchAgent für Auto-Start beim Login.
Graceful Shutdown beim SIGTERM killt alle PTYs sauber.
