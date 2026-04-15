# iOS Native-Feel Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terminal-View auf iOS von „Web-App im Browser" zu „fühlt sich nativ an" bringen — sechs chirurgische Fixes in `public/index.html`.

**Architecture:** Alle Änderungen liegen im Single-File-Frontend `public/index.html` (inline CSS + inline JS, kein Build-Step). Keine Backend-Änderungen, keine neuen Dependencies. Jede Task ist unabhängig testbar und committet einzeln.

**Tech Stack:** Vanilla JS, xterm.js (via CDN), node-pty/tmux-Backend unverändert. Manuelles Testing auf iPhone Safari + Desktop-Chrome (keine Test-Suite im Projekt — per `CLAUDE.md`: „Kein Build-Step, keine Tests, keine Linter").

**Spec:** `docs/superpowers/specs/2026-04-15-ios-native-feel-design.md`

**Testing-Umgebung:**
- Der Hub läuft via LaunchAgent auf Port 3333, extern erreichbar via `https://code.derremo.xyz`.
- Nach Code-Änderung muss der LaunchAgent neugestartet werden: `launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub`
- iPhone Safari → https://code.derremo.xyz öffnen → Terminal-Session starten → testen.
- Jede Task endet mit einem Commit — der nächste Task arbeitet auf sauberem State weiter.

**Globale Regel für Line-Referenzen:** Die in diesem Plan genannten Zeilennummern beziehen sich auf den Stand **vor** Task 1. Jede Task verschiebt Zeilen, also nach jedem Commit bitte neue Line-Referenzen per `grep`/Suche im File finden, nicht blind die Zahlen verwenden. Die Plan-Text-Anker (z.B. „`updateKeyboardInset()`-Funktion", „der `setupTouchBar`-Block nach `popstate`") sind die eigentliche Wahrheit.

---

## File Structure

**Modified file:**
- `public/index.html` — alle 6 Fixes. Betroffene Regionen:
  - CSS `@media (pointer: coarse)` Block (~Zeile 1977) — Fix 6
  - CSS `.touch-key.sticky-active` Regel (~Zeile 2010) — Fix 5
  - HTML `#touch-bar` Buttons (~Zeile 2957-2969) — Fix 4
  - JS nach `term.open(container)` (~Zeile 5227) — Fix 2
  - JS Touch-Scroll-Block in `connectTerminal()` (~Zeile 5399-5443) — Fix 1
  - JS `sendRawInput()` + `setCtrlSticky()` (~Zeile 5561-5572) — Fix 5
  - JS `updateKeyboardInset()` (~Zeile 5583-5590) — Fix 3
  - JS Touch-Toolbar-Setup nach `popstate` (~Zeile 6157-6175) — Fix 4

**No files created, no files deleted.**

---

## Task 1: Dynamic `PX_PER_LINE` + Sub-Line-Smoothness für Terminal-Scroll

**Files:**
- Modify: `public/index.html` — Touch-Scroll-Block in `connectTerminal()` (suche nach `// Touch-Scrolling: Claude Code läuft im Alt-Screen-Buffer`)

**Kontext:** Der existierende Block berechnet `PX_PER_LINE = 24` fest und sendet Wheel-Events an tmux sobald die akkumulierten Finger-Pixel eine Zeile überschreiten. Wir machen `PX_PER_LINE` dynamisch (aus xterm-Cell-Height) und schieben den Terminal-Inhalt während des Drags visuell per CSS-Transform mit — so dass Sub-Line-Bewegungen sichtbar werden. Beim Überschreiten einer Zeilengrenze: Wheel-Event senden, Transform auf den Rest reduzieren. Beim `touchend`: verbleibenden Rest entweder snap-zurück (0) oder komplett durchführen (ein weiteres Wheel) — dieser Plan implementiert **Snap-Back mit Threshold-Finish**: wenn `|rest| > cellHeight/2`, ein zusätzliches Wheel senden, dann auf 0 snappen. Sonst sofort auf 0 snappen.

**Welches Element transformieren:** `.xterm-screen` innerhalb `container`. Die Selection-Overlay-Logik (Shift/Alt-Drag) operiert auf `container` selbst und berechnet Pixel-Koordinaten über `container.getBoundingClientRect()` — der Transform auf `.xterm-screen` beeinflusst die Overlay-Koordinaten nicht, weil das Overlay ein separates Child von `container` ist. Während aktivem Touch-Drag ist keine Shift-Selection möglich (unterschiedliche Event-Typen: touch vs. mouse + shift), daher kein Race.

- [ ] **Step 1.1: Finde den Touch-Scroll-Block**

Grep nach `Touch-Scrolling: Claude Code läuft im Alt-Screen-Buffer` in `public/index.html`. Der Block ist ~45 Zeilen lang und endet mit den drei `container.addEventListener('touchstart|touchmove|touchend'|touchcancel')` Calls.

- [ ] **Step 1.2: Ersetze den kompletten Block**

Aktueller Block (zum Finden — nicht blind kopieren, aktuellen Stand prüfen):

```javascript
      // Touch-Scrolling: Claude Code läuft im Alt-Screen-Buffer, da hat
      // xterm selbst keinen Scrollback — die Historie gehört tmux. Wir
      // übersetzen vertikale Swipes in SGR-Mouse-Wheel-Escape-Sequenzen
      // (\x1b[<64;1;1M = wheel up, \x1b[<65;1;1M = wheel down). Tmux läuft
      // mit `mouse on` und interpretiert sie als echte Scroll-Events,
      // was sowohl im Alt-Screen als auch im Normal-Screen funktioniert.
      // Test: scroll_position 0 → 20 → 70 nach 1/5/15 Wheel-Events bestätigt.
      //
      // touch-action: none im CSS verhindert, dass iOS die Swipes als
      // native Page-Scroll abfängt — ohne das landen touchmove-Events
      // nie in diesem Handler.
      {
        touchScrollAbort?.abort();
        touchScrollAbort = new AbortController();
        const signal = touchScrollAbort.signal;
        const PX_PER_LINE = 24;
        let touchLastY = null;
        let touchAccum = 0;
        container.addEventListener('touchstart', (e) => {
          if (e.touches.length !== 1) { touchLastY = null; return; }
          touchLastY = e.touches[0].clientY;
          touchAccum = 0;
        }, { capture: true, passive: true, signal });
        container.addEventListener('touchmove', (e) => {
          if (touchLastY === null || e.touches.length !== 1) return;
          const y = e.touches[0].clientY;
          const dy = touchLastY - y;       // >0 = Finger hoch = wheel down
          touchLastY = y;
          touchAccum += dy / PX_PER_LINE;
          const lines = touchAccum > 0 ? Math.floor(touchAccum) : Math.ceil(touchAccum);
          if (lines !== 0) {
            touchAccum -= lines;
            const button = lines < 0 ? 64 : 65;
            const count = Math.abs(lines);
            const seq = `\x1b[<${button};1;1M`.repeat(count);
            if (currentWs && currentWs.readyState === WebSocket.OPEN) {
              currentWs.send(JSON.stringify({ type: 'input', data: seq }));
            }
            e.preventDefault();
          }
        }, { capture: true, passive: false, signal });
        const endTouch = () => { touchLastY = null; };
        container.addEventListener('touchend', endTouch, { capture: true, passive: true, signal });
        container.addEventListener('touchcancel', endTouch, { capture: true, passive: true, signal });
      }
```

**Neuer Block — komplett ersetzen:**

```javascript
      // Touch-Scrolling: Claude Code läuft im Alt-Screen-Buffer, da hat
      // xterm selbst keinen Scrollback — die Historie gehört tmux. Wir
      // übersetzen vertikale Swipes in SGR-Mouse-Wheel-Escape-Sequenzen
      // (\x1b[<64;1;1M = wheel up, \x1b[<65;1;1M = wheel down). Tmux läuft
      // mit `mouse on` und interpretiert sie als echte Scroll-Events,
      // was sowohl im Alt-Screen als auch im Normal-Screen funktioniert.
      //
      // Sub-Line-Smoothness: Während des Drags wird .xterm-screen per
      // translateY in Echtzeit mit dem Finger mitgeschoben — auch innerhalb
      // einer Zeile. Sobald eine Zeilengrenze überschritten wird, feuern
      // wir ein Wheel-Event an tmux und reduzieren die Translation um
      // genau eine Zeilenhöhe. Tmux-Redraw ersetzt dann die visuelle
      // Translation durch echtes Scrolling. Pixelgenaues Gefühl ohne
      // Architektur-Änderung.
      //
      // touch-action: none im CSS verhindert, dass iOS die Swipes als
      // native Page-Scroll abfängt.
      {
        touchScrollAbort?.abort();
        touchScrollAbort = new AbortController();
        const signal = touchScrollAbort.signal;

        // Dynamische Cell-Height — wird bei jedem touchstart neu gelesen
        // (Font-Resize, Rotation, Zoom können sie ändern).
        const getCellHeight = () => {
          try {
            const h = term?._core?._renderService?.dimensions?.css?.cell?.height;
            if (h && h > 0) return h;
          } catch {}
          const row = container.querySelector('.xterm-rows > div');
          const rect = row?.getBoundingClientRect();
          if (rect && rect.height > 0) return rect.height;
          return 24; // Fallback
        };

        const screen = container.querySelector('.xterm-screen');
        let cellH = 24;
        let touchLastY = null;
        let touchAccumPx = 0;   // Rest-Pixel in Sub-Line-Range
        let snapRafId = 0;

        const setScreenTransform = (px) => {
          if (!screen) return;
          screen.style.transform = px ? `translate3d(0,${px}px,0)` : '';
        };

        const snapBack = () => {
          // Sanft auf 0 zurück via CSS-Transition. Kein JS-Loop.
          if (!screen) return;
          screen.style.transition = 'transform 150ms ease-out';
          screen.style.transform = '';
          // Transition nach Ablauf wieder entfernen, damit nächster Drag
          // ohne Lag reagiert.
          clearTimeout(snapRafId);
          snapRafId = setTimeout(() => {
            if (screen) screen.style.transition = '';
          }, 170);
        };

        container.addEventListener('touchstart', (e) => {
          if (e.touches.length !== 1) { touchLastY = null; return; }
          // Falls noch eine Snap-Back-Transition läuft → abbrechen.
          if (screen) screen.style.transition = '';
          clearTimeout(snapRafId);
          cellH = getCellHeight();
          touchLastY = e.touches[0].clientY;
          touchAccumPx = 0;
          setScreenTransform(0);
        }, { capture: true, passive: true, signal });

        container.addEventListener('touchmove', (e) => {
          if (touchLastY === null || e.touches.length !== 1) return;
          const y = e.touches[0].clientY;
          const dy = touchLastY - y;   // >0 = Finger hoch = wheel down
          touchLastY = y;
          touchAccumPx += dy;

          // Wie viele komplette Zeilen sind abgedeckt?
          const linesSigned = touchAccumPx > 0
            ? Math.floor(touchAccumPx / cellH)
            : Math.ceil(touchAccumPx / cellH);

          if (linesSigned !== 0) {
            touchAccumPx -= linesSigned * cellH;
            const button = linesSigned < 0 ? 64 : 65;
            const count = Math.abs(linesSigned);
            const seq = `\x1b[<${button};1;1M`.repeat(count);
            if (currentWs && currentWs.readyState === WebSocket.OPEN) {
              currentWs.send(JSON.stringify({ type: 'input', data: seq }));
            }
          }

          // Sub-Line-Smoothness: Rest-Pixel visuell mitnehmen.
          // Vorzeichen: Finger hoch (dy > 0) → Content soll hoch gleiten
          // (wheel down). touchAccumPx ist positiv → translateY negativ.
          setScreenTransform(-touchAccumPx);
          e.preventDefault();
        }, { capture: true, passive: false, signal });

        const endTouch = () => {
          if (touchLastY === null) return;
          touchLastY = null;

          // Threshold-Finish: wenn der Rest mehr als eine halbe Zeile
          // beträgt, ein zusätzliches Wheel-Event feuern — fühlt sich
          // besser an als immer zurück zu snappen.
          if (Math.abs(touchAccumPx) > cellH / 2) {
            const linesSigned = touchAccumPx > 0 ? 1 : -1;
            const button = linesSigned < 0 ? 64 : 65;
            const seq = `\x1b[<${button};1;1M`;
            if (currentWs && currentWs.readyState === WebSocket.OPEN) {
              currentWs.send(JSON.stringify({ type: 'input', data: seq }));
            }
          }
          touchAccumPx = 0;
          snapBack();
        };
        container.addEventListener('touchend', endTouch, { capture: true, passive: true, signal });
        container.addEventListener('touchcancel', endTouch, { capture: true, passive: true, signal });
      }
```

- [ ] **Step 1.3: Manueller Test (Desktop)**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

Desktop-Browser auf `https://code.derremo.xyz` → Terminal-Session öffnen → mit Maus scrollen (Wheel). Erwartet: Scrollt wie vorher, keine Regression (der Touch-Handler ist gated auf `touches.length === 1` und feuert bei Maus-Events nicht).

- [ ] **Step 1.4: Manueller Test (iPhone)**

iPhone-Safari auf `https://code.derremo.xyz` → Terminal-Session öffnen → Output mit Inhalt füllen (`seq 200` o.ä.) → langsam und schnell swipen.

Erwartet:
- Content folgt Finger pixelgenau innerhalb einer Zeile (sichtbar smooth).
- Beim Überschreiten der Zeilenhöhe springt nichts sichtbar, Tmux-Redraw und Transform-Reset fallen zusammen.
- Beim Loslassen mit halber Zeile Rest: entweder snap-zurück oder eine Zeile vor (je nach Finger-Delta).
- Keine Stufen mehr unterhalb der Zeilengrenze.

- [ ] **Step 1.5: Commit**

```bash
git add public/index.html
git commit -m "$(cat <<'EOF'
ios: smooth terminal scroll via transform + dynamic cell-height

Sub-Line-Smoothness für Terminal-Swipes: .xterm-screen wird während
des Drags per translate3d mit dem Finger mitgeschoben. Bei Überschreiten
einer Zeilengrenze wird ein Wheel-Event an tmux gefeuert und der
Transform reduziert. PX_PER_LINE kommt dynamisch aus xterm-Cell-Height
statt hardcoded 24. Beim touchend: Threshold-Finish bei >cellHeight/2
Rest, sonst Snap-Back per CSS-Transition.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: iOS-Input-Attribute auf `.xterm-helper-textarea`

**Files:**
- Modify: `public/index.html` — direkt nach `term.open(container);` (~Zeile 5227)

**Kontext:** xterm.js erzeugt die `.xterm-helper-textarea` erst beim `term.open()`. Wir müssen die iOS-Attribute unmittelbar danach per JS setzen. Das killt sowohl das Tipp-Hakeln (kein Composition-Layer mehr) als auch die QuickType-Bar oberhalb der Tastatur (iOS versteckt sie bei `autocorrect="off"`).

- [ ] **Step 2.1: Finde `term.open(container);`**

Grep in `public/index.html`: `term.open(container);` (eine Stelle). Direkt danach steht ein Kommentar über den Test-Hook.

- [ ] **Step 2.2: Füge Attribut-Setter direkt nach `term.open(container);` ein**

**Vor:**
```javascript
      term.open(container);
      // Test-Hook für Playwright (tests/copy.spec.js). Single-User-App,
      // kein Security-Risiko — ein Angreifer mit JS-Kontext hat ohnehin
      // schon alles was er braucht.
      window.__cchubTerm = term;
```

**Nach:**
```javascript
      term.open(container);

      // iOS-Input-Hardening: xterm.js' Helper-Textarea ist ein unsichtbares
      // <textarea>, das alle Tipp-Events einfängt. Ohne diese Attribute
      // routet iOS Eingaben durch den Composition-Layer (autocorrect),
      // verschluckt/verzögert Zeichen und zeigt die QuickType-Predictive-
      // Bar über der Tastatur. Jedes Attribut killt eine dieser Plagen.
      // Muss nach term.open() passieren, weil die Textarea vorher nicht
      // existiert. Idempotent — läuft bei jedem connectTerminal().
      {
        const ta = container.querySelector('.xterm-helper-textarea');
        if (ta) {
          ta.setAttribute('autocorrect', 'off');
          ta.setAttribute('autocapitalize', 'off');
          ta.setAttribute('autocomplete', 'off');
          ta.setAttribute('spellcheck', 'false');
        }
      }

      // Test-Hook für Playwright (tests/copy.spec.js). Single-User-App,
      // kein Security-Risiko — ein Angreifer mit JS-Kontext hat ohnehin
      // schon alles was er braucht.
      window.__cchubTerm = term;
```

- [ ] **Step 2.3: Manueller Test (iPhone)**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

iPhone → Terminal → tippe `ls -la ~/Projects` in eine Shell oder Claude-Prompt.

Erwartet:
- Jedes Zeichen kommt sofort an, keine Verzögerung, keine doppelten Buchstaben.
- Kein Auto-Großschreiben (`L` statt `l`).
- **Keine graue QuickType-Bar** zwischen Tastatur und Touch-Bar. Die Touch-Bar klebt direkt über der Tastatur.
- Keine Smart-Quotes beim Tippen von `"`.

- [ ] **Step 2.4: Manueller Test (Desktop)**

Desktop → Terminal → tippen. Erwartet: unverändert, keine Regression.

- [ ] **Step 2.5: Commit**

```bash
git add public/index.html
git commit -m "$(cat <<'EOF'
ios: disable autocorrect/quicktype on xterm helper-textarea

Setzt autocorrect/autocapitalize/autocomplete/spellcheck auf der
.xterm-helper-textarea direkt nach term.open(). Killt das iOS-
Keyboard-Hakeln (kein Composition-Layer mehr) und versteckt die
QuickType-Predictive-Bar über der Tastatur — ~40-45px vertikaler
Platz zurückgewonnen.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Touch-Bar Position via `translate3d` + rAF-Throttle

**Files:**
- Modify: `public/index.html` — `updateKeyboardInset()` Funktion (~Zeile 5583)

**Kontext:** Aktuell setzt der Handler direkt `bar.style.bottom = <inset>px` auf jedes `visualViewport.resize`-Event. iOS feuert während der Keyboard-Animation ~5-10 Events mit Zwischen-Heights, jeder triggert einen Layout-Pass → sichtbares Jittern. Wir wechseln auf `transform: translate3d(0,-<inset>px,0)` (compositor-only, GPU) und kapseln die Logik in einen rAF-Guard, damit mehrere schnell hintereinander kommende Events pro Frame zusammengefasst werden.

- [ ] **Step 3.1: Finde `updateKeyboardInset`**

Grep `function updateKeyboardInset()` in `public/index.html`. Die Funktion ist ~8 Zeilen lang.

- [ ] **Step 3.2: Ersetze die Funktion komplett**

**Vor:**
```javascript
    function updateKeyboardInset() {
      const vv = window.visualViewport;
      if (!vv) return;
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb-inset', `${inset}px`);
      const bar = document.getElementById('touch-bar');
      if (bar) bar.style.bottom = inset > 0 ? `${inset}px` : '';
    }
```

**Nach:**
```javascript
    // iOS feuert während der Keyboard-Animation ~5-10 visualViewport.resize-
    // Events mit Zwischen-Heights. Wir rAF-throttlen, damit sie sich pro
    // Frame bündeln. Position wird per translate3d (GPU-compositor) statt
    // `bottom`-Layout gesetzt → smooth statt Jitter.
    let kbRafPending = false;
    function updateKeyboardInset() {
      if (kbRafPending) return;
      kbRafPending = true;
      requestAnimationFrame(() => {
        kbRafPending = false;
        const vv = window.visualViewport;
        if (!vv) return;
        const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        document.documentElement.style.setProperty('--kb-inset', `${inset}px`);
        const bar = document.getElementById('touch-bar');
        if (bar) bar.style.transform = inset > 0 ? `translate3d(0,-${inset}px,0)` : '';
      });
    }
```

- [ ] **Step 3.3: Manueller Test (iPhone)**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

iPhone → Terminal → Tap ins Terminal (Tastatur auf) → Done/Dismiss (Tastatur zu). Mehrfach wiederholen.

Erwartet:
- Touch-Bar gleitet smooth mit der Keyboard-Animation mit — kein Zucken, kein Sprung.
- Endposition korrekt: Bar sitzt direkt über der Tastatur (bei aufgeklappter) bzw. am unteren Bildschirmrand + safe-area (bei eingeklappter).

- [ ] **Step 3.4: Test Adressbar-Collapse**

iPhone → Terminal-View → scrolle leicht im Terminal → Safari collapst die Adressbar → `visualViewport.scroll` feuert → Touch-Bar-Position soll smooth mitgehen.

Erwartet: Position stimmt nach Adressbar-Collapse, kein Jittern.

- [ ] **Step 3.5: Commit**

```bash
git add public/index.html
git commit -m "$(cat <<'EOF'
ios: smooth touch-bar positioning via translate3d + rAF

updateKeyboardInset throttlet visualViewport.resize/scroll auf einen
rAF-Tick und positioniert #touch-bar via transform:translate3d statt
bottom. Compositor-only Updates, kein Layout-Trigger → kein Jitter
mehr während iOS-Keyboard-Animation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Pfeiltasten Key-Repeat

**Files:**
- Modify: `public/index.html` — HTML `#touch-bar` Buttons (~Zeile 2957-2969) und JS Touch-Toolbar-Setup (~Zeile 6157-6175)

**Kontext:** Aktuell feuert jede Touch-Bar-Taste einen `click`-Listener → ein Send pro Tap. Pfeiltasten werden beim Halten nicht wiederholt. Wir markieren die vier Pfeiltasten mit `data-repeat` und rüsten den Handler um: bei `pointerdown` + `data-repeat` wird nach 400ms Delay ein 50ms-Intervall gestartet, das den Seq-Send wiederholt. Stop bei `pointerup`/`pointercancel`/`pointerleave`.

- [ ] **Step 4.1: HTML — `data-repeat` auf Pfeiltasten**

Finde in `public/index.html` den `#touch-bar`-Block:

```html
  <!-- ── Touch-Toolbar über der iOS-Tastatur ───────────────────── -->
  <div class="touch-bar" id="touch-bar" role="toolbar" aria-label="Virtuelle Tasten">
    <button class="touch-key" type="button" data-seq="\x1b">Esc</button>
    <button class="touch-key" type="button" data-seq="\t">Tab</button>
    <button class="touch-key" type="button" data-ctrl>Ctrl</button>
    <button class="touch-key" type="button" data-seq="\x1b[A">↑</button>
    <button class="touch-key" type="button" data-seq="\x1b[B">↓</button>
    <button class="touch-key" type="button" data-seq="\x1b[D">←</button>
    <button class="touch-key" type="button" data-seq="\x1b[C">→</button>
    <button class="touch-key" type="button" data-seq="|">|</button>
    <button class="touch-key" type="button" data-seq="~">~</button>
    <button class="touch-key" type="button" data-seq="/">/</button>
    <button class="touch-key touch-key--wide" type="button" data-seq="\x03">Ctrl+C</button>
  </div>
```

Ersetze die vier Pfeil-Zeilen durch:

```html
    <button class="touch-key" type="button" data-seq="\x1b[A" data-repeat>↑</button>
    <button class="touch-key" type="button" data-seq="\x1b[B" data-repeat>↓</button>
    <button class="touch-key" type="button" data-seq="\x1b[D" data-repeat>←</button>
    <button class="touch-key" type="button" data-seq="\x1b[C" data-repeat>→</button>
```

- [ ] **Step 4.2: JS — Handler-Setup ersetzen**

Finde den Block direkt nach dem `popstate`-Handler:

```javascript
    // Touch-Toolbar: Button-Handler. data-seq enthält die Escape-Sequenz
    // als JS-String-Literal (\x1b, \t, …) und wird hier einmal dekodiert.
    document.querySelectorAll('#touch-bar .touch-key').forEach(btn => {
      if (btn.dataset.ctrl !== undefined) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          setCtrlSticky(!pendingCtrl);
        });
        return;
      }
      const raw = btn.dataset.seq || '';
      const decoded = raw
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\t/g, '\t')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        sendRawInput(decoded);
      });
    });
```

**Ersetze durch:**

```javascript
    // Touch-Toolbar: Button-Handler. data-seq enthält die Escape-Sequenz
    // als JS-String-Literal (\x1b, \t, …) und wird hier einmal dekodiert.
    // Tasten mit data-repeat (die vier Pfeile) bekommen Key-Repeat:
    // pointerdown → sofort Send → 400ms Delay → Interval 50ms, bis
    // pointerup/cancel/leave.
    document.querySelectorAll('#touch-bar .touch-key').forEach(btn => {
      if (btn.dataset.ctrl !== undefined) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          setCtrlSticky(!pendingCtrl);
        });
        return;
      }
      const raw = btn.dataset.seq || '';
      const decoded = raw
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\t/g, '\t')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r');

      if (btn.dataset.repeat !== undefined) {
        // Key-Repeat-Pfad: pointerdown startet Repeat-Loop, Up/Cancel/
        // Leave stoppt ihn. Pro-Button-lokaler State (in Closure), kein
        // globaler Mutex.
        let delayId = 0;
        let intervalId = 0;
        const stop = () => {
          clearTimeout(delayId); delayId = 0;
          clearInterval(intervalId); intervalId = 0;
        };
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          sendRawInput(decoded);
          stop(); // falls ein alter Repeat noch läuft
          delayId = setTimeout(() => {
            intervalId = setInterval(() => sendRawInput(decoded), 50);
          }, 400);
        });
        btn.addEventListener('pointerup', stop);
        btn.addEventListener('pointercancel', stop);
        btn.addEventListener('pointerleave', stop);
      } else {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          sendRawInput(decoded);
        });
      }
    });
```

- [ ] **Step 4.3: Manueller Test (iPhone)**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

iPhone → Terminal → Shell-Prompt → `↑` auf der Touch-Bar gedrückt halten.

Erwartet:
- Ein Sofort-Event bei Tap-Down (erste History-Zeile).
- Nach ~400ms startet Repeat → Bash History läuft flott nach oben.
- Loslassen stoppt den Repeat sofort.
- Esc/Tab halten → nur ein Event (kein Repeat für diese Tasten).
- Swipe-weg vom Button (pointerleave) stoppt auch den Repeat.

- [ ] **Step 4.4: Manueller Test (Desktop)**

Desktop-Browser → Terminal → klicke Pfeiltasten. Erwartet: funktioniert weiterhin per Klick (pointerdown feuert auch bei Maus).

- [ ] **Step 4.5: Commit**

```bash
git add public/index.html
git commit -m "$(cat <<'EOF'
ios: key-repeat für Touch-Bar-Pfeiltasten

Die vier Pfeiltasten bekommen data-repeat; der Touch-Bar-Handler startet
bei pointerdown nach 400ms einen 50ms-Repeat-Loop. pointerup/cancel/
leave stoppt. Esc/Tab/Ctrl/Pipe/Tilde/Slash/Ctrl+C bleiben single-tap.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Ctrl-Sticky härten — Touch-Bar respektiert Ctrl, Auto-Release, visueller Glow

**Files:**
- Modify: `public/index.html` — `.touch-key.sticky-active` CSS (~Zeile 2010), `sendRawInput()` + `setCtrlSticky()` JS (~Zeile 5561-5572), `term.onData`-Handler (~Zeile 5545)

**Kontext:** Das existierende Sticky-Ctrl transformiert nur im `term.onData`-Path (iOS-Tastatur-Input). Touch-Bar-Tasten gehen durch `sendRawInput`, das Ctrl nicht prüft → tapping Ctrl + `|` sendet rohes `|` und Ctrl bleibt stale. Wir extrahieren die Transform in einen gemeinsamen Helper, lassen `sendRawInput` ihn auch nutzen, fügen 4s-Auto-Release hinzu und machen den visuellen Active-State unübersehbar.

- [ ] **Step 5.1: CSS — Glow + Pulse-Keyframes**

Finde im CSS:

```css
    .touch-key.sticky-active {
      background: var(--teal);
      color: var(--bg-deep);
      border-color: var(--teal);
    }
```

**Ersetze durch:**

```css
    @keyframes touch-key-sticky-pulse {
      0%, 100% { box-shadow: 0 0 0 2px var(--teal), 0 0 8px rgba(45, 212, 191, 0.35); }
      50%      { box-shadow: 0 0 0 2px var(--teal), 0 0 16px rgba(45, 212, 191, 0.65); }
    }
    .touch-key.sticky-active {
      background: var(--teal);
      color: var(--bg-deep);
      border-color: var(--teal);
      animation: touch-key-sticky-pulse 1.2s ease-in-out infinite;
    }
```

- [ ] **Step 5.2: JS — Gemeinsamen `applyPendingCtrl`-Helper extrahieren**

Finde `sendRawInput` und `setCtrlSticky`:

```javascript
    // ── Touch-Toolbar: Keys → Terminal senden ────────────────────
    function sendRawInput(data) {
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        currentWs.send(JSON.stringify({ type: 'input', data }));
      }
      if (currentTerminal) currentTerminal.focus();
    }
    function setCtrlSticky(active) {
      pendingCtrl = active;
      document.querySelectorAll('.touch-key[data-ctrl]').forEach(el => {
        el.classList.toggle('sticky-active', active);
      });
    }
```

**Ersetze den ganzen Block durch:**

```javascript
    // ── Touch-Toolbar: Keys → Terminal senden ────────────────────
    // Shared Ctrl-Transform: 0x40-0x7E ASCII → Ctrl+letter (0x00-0x1F
    // via `& 0x1F`). Wird sowohl von term.onData (iOS-Keyboard-Input)
    // als auch von sendRawInput (Touch-Bar-Tasten) genutzt, damit
    // pendingCtrl in beiden Pfaden konsistent wirkt.
    function applyPendingCtrl(data) {
      if (!pendingCtrl || data.length !== 1) return data;
      const code = data.charCodeAt(0);
      if (code >= 0x40 && code <= 0x7e) {
        setCtrlSticky(false);
        return String.fromCharCode(code & 0x1f);
      }
      return data;
    }

    function sendRawInput(data) {
      const out = applyPendingCtrl(data);
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        currentWs.send(JSON.stringify({ type: 'input', data: out }));
      }
      if (currentTerminal) currentTerminal.focus();
    }

    // setCtrlSticky managed Sticky-State + 4s Auto-Release. Wenn Ctrl
    // aktiviert wird und keine Folge-Taste innerhalb 4s kommt,
    // deaktiviert sich der Modifier selbst → kein stale State.
    let ctrlStickyTimer = 0;
    function setCtrlSticky(active) {
      pendingCtrl = active;
      document.querySelectorAll('.touch-key[data-ctrl]').forEach(el => {
        el.classList.toggle('sticky-active', active);
      });
      clearTimeout(ctrlStickyTimer);
      if (active) {
        ctrlStickyTimer = setTimeout(() => {
          setCtrlSticky(false);
        }, 4000);
      }
    }
```

- [ ] **Step 5.3: JS — `term.onData` auf Shared-Helper umstellen**

Finde den `term.onData`-Block (ca. Zeile 5545):

```javascript
      term.onData(data => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (pendingCtrl && data.length === 1) {
          const code = data.charCodeAt(0);
          if (code >= 0x40 && code <= 0x7e) {
            data = String.fromCharCode(code & 0x1f);
          }
          setCtrlSticky(false);
        }
        ws.send(JSON.stringify({ type: 'input', data }));
      });
```

**Ersetze durch:**

```javascript
      term.onData(data => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const out = applyPendingCtrl(data);
        ws.send(JSON.stringify({ type: 'input', data: out }));
      });
```

**Wichtig:** `applyPendingCtrl` muss **vor** `connectTerminal` / `term.onData` im Datei-Scope erreichbar sein. Weil beide Funktionen Top-Level (nicht nested) deklariert sind, ist die Reihenfolge egal — JS-Function-Hoisting greift. Einfach platzieren wo schon `sendRawInput` steht.

- [ ] **Step 5.4: Manueller Test (iPhone)**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

iPhone → Terminal → Shell-Prompt.

**Test A — Ctrl + iOS-Tastatur:**
1. Tap Ctrl-Button → Button pulst teal.
2. Tippe `c` auf der iOS-Tastatur → Ctrl+C wird gesendet (Shell unterbricht), Pulse verschwindet.

**Test B — Ctrl + Touch-Bar:**
1. Tap Ctrl → pulst.
2. Tap `|` in der Touch-Bar → Ctrl+| (0x1C) gesendet, Pulse weg. (Optisch prüft man's daran, dass der Pulse verschwindet und dass tmux evtl. darauf reagiert — konkret ist Ctrl+| relativ harmlos, also alternativ: Ctrl + `/` → Ctrl+_ = 0x1F, auch wenig sichtbar. Klarster Test: Ctrl + `A` bzw. `a` auf iOS-Tastatur nachdem Touch-Bar-Ctrl aktiviert wurde — funktioniert weil beide Pfade jetzt gleich sind.)

**Test C — Auto-Release:**
1. Tap Ctrl → pulst.
2. Warte 4 Sekunden ohne irgendwas zu tun.
3. Erwartet: Pulse verschwindet von selbst, `pendingCtrl` ist wieder false.

- [ ] **Step 5.5: Commit**

```bash
git add public/index.html
git commit -m "$(cat <<'EOF'
ios: Ctrl-sticky härten — shared transform, auto-release, glow

- sendRawInput und term.onData nutzen jetzt shared applyPendingCtrl —
  Touch-Bar-Keys respektieren pendingCtrl genauso wie iOS-Keyboard-Input.
- setCtrlSticky(true) startet einen 4s-Timer, der auto-released falls
  keine Folge-Taste kommt — kein stale State mehr.
- .sticky-active bekommt pulsierenden teal-Glow via keyframes, damit
  der aktive Modifier unübersehbar ist.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: App-Header auf Mobile in Terminal-View verstecken

**Files:**
- Modify: `public/index.html` — CSS `@media (pointer: coarse)` Block (~Zeile 1977-1982)

**Kontext:** Der globale `.header` (64px + safe-area-inset-top ≈ 108px) ist in Terminal-View auf Mobile funktional leer — Back-Navigation und Session-Name sind in der `.terminal-toolbar` darunter, Push/Sound/Theme-Toggles + Kbd-Help sind Settings, die man während Terminal-Arbeit nicht braucht. Wir verstecken ihn in Terminal-View auf `pointer:coarse`-Geräten und passen die `.terminal-view`-Höhe an.

- [ ] **Step 6.1: Finde den `@media (pointer: coarse)`-Block**

Grep `@media (pointer: coarse)` — mehrere Treffer. Wir brauchen den Block, der `.touch-bar` sichtbar macht (suche nach `body[data-current-view="terminal"] .touch-bar`).

Aktuell:
```css
    @media (pointer: coarse) {
      body[data-current-view="terminal"] .touch-bar { display: flex; }
      body[data-current-view="terminal"] .terminal-view {
        padding-bottom: calc(44px + env(safe-area-inset-bottom));
      }
    }
```

- [ ] **Step 6.2: Block erweitern**

**Ersetze durch:**

```css
    @media (pointer: coarse) {
      body[data-current-view="terminal"] .touch-bar { display: flex; }
      body[data-current-view="terminal"] .terminal-view {
        padding-bottom: calc(44px + env(safe-area-inset-bottom));
      }
      /* App-Header in Terminal-View auf Mobile verstecken — Back-Button
         und Session-Name sind bereits in der .terminal-toolbar.
         ~108px vertikaler Platz zurückgewonnen auf iPhone mit Notch.
         Trade-off: Push/Sound/Theme-Toggles + Kbd-Help nicht erreichbar
         während Terminal-View. Im Dashboard-View bleibt der Header da. */
      body[data-current-view="terminal"] .header { display: none; }
      body[data-current-view="terminal"] .terminal-view {
        height: calc(100dvh - var(--kb-inset, 0px));
      }
    }
```

**Wichtig:** Die zweite `.terminal-view`-Regel innerhalb des Blocks überschreibt die globale (`height: calc(100dvh - 64px - env(safe-area-inset-top) - var(--kb-inset, 0px))`) nur für den Mobile-Terminal-Case. Existierendes `padding-bottom` bleibt im ersten `.terminal-view`-Block des Media-Queries erhalten.

- [ ] **Step 6.3: Manueller Test (iPhone)**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

iPhone → Dashboard (Header sichtbar) → Tap Session-Card → Terminal-View.

Erwartet:
- Kein App-Header mehr sichtbar. Terminal beginnt direkt unter der Status-Bar / Notch-Bereich.
- Terminal-Toolbar (Back-Button + Session-Name + Disconnect + Kill) bleibt sichtbar.
- Terminal nutzt gesamten Raum bis zur Touch-Bar.
- Back-Button → zurück zum Dashboard → Header wieder da.

- [ ] **Step 6.4: Test Keyboard-Interaktion**

iPhone → Terminal-View → Tastatur öffnen → schließen.

Erwartet:
- Höhen-Berechnung bleibt korrekt. `--kb-inset` zieht weiterhin vom Terminal ab (wegen `calc(100dvh - var(--kb-inset, 0px))`).

- [ ] **Step 6.5: Manueller Test (Desktop)**

Desktop-Browser → Dashboard → Terminal-View.

Erwartet: Header bleibt sichtbar (Desktop ist `pointer: fine`, nicht `coarse`). Keine Regression.

- [ ] **Step 6.6: Commit**

```bash
git add public/index.html
git commit -m "$(cat <<'EOF'
ios: App-Header in Terminal-View auf Mobile verstecken

Auf pointer:coarse-Geräten ist der globale Header in Terminal-View
funktional leer — Back und Session-Name sind in der terminal-toolbar,
Settings-Toggles braucht man während Terminal-Arbeit nicht. ~108px
vertikaler Platz zurückgewonnen auf iPhone mit Notch. Dashboard-View
und Desktop bleiben unverändert.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Step F.1: Alle 6 Commits im Log**

```bash
git log --oneline -8
```

Erwartet: Die 6 `ios: …` Commits aus Tasks 1-6 liegen auf `main` (oder dem Worktree-Branch).

- [ ] **Step F.2: End-to-End iPhone-Test**

iPhone → `https://code.derremo.xyz` → Terminal-Session öffnen → folgende Szenarien durchgehen:

1. **Scrollen:** Swipe im Terminal fühlt sich pixelgenau an, keine Stufen.
2. **Tippen:** Tippe `ls -la && echo "hello world"` — jedes Zeichen kommt an, keine Großschreibung, keine Smart-Quotes.
3. **Keyboard-Layout:** Keine graue QuickType-Bar zwischen Tastatur und Touch-Bar.
4. **Touch-Bar Position:** Tastatur auf/zu mehrfach — Bar gleitet smooth mit.
5. **Pfeil-Repeat:** `↑` halten → History läuft nach oben.
6. **Ctrl+C:** Ctrl tippen + `c` auf Tastatur → Shell unterbricht, Pulse weg.
7. **Ctrl Auto-Release:** Ctrl tippen + 5s warten → Pulse verschwindet alleine.
8. **Header versteckt:** App-Header fehlt in Terminal-View, wieder da im Dashboard.

- [ ] **Step F.3: End-to-End Desktop-Test**

Desktop-Browser → `https://code.derremo.xyz` → Terminal-Session.

Erwartet: Keine Regression — Scrollen per Wheel, Tippen per Desktop-Keyboard, Header in Terminal-View sichtbar, Touch-Bar versteckt.

---

## Rollback

Falls eines der Fixes Regressions zeigt:

```bash
git log --oneline -8  # finde den commit
git revert <sha>
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

Alle Tasks sind unabhängig committet → einzelne Reverts möglich, kein State-Migration-Risiko.
