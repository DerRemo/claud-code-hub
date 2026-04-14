# Desktop Copy/Paste Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop Copy (Cmd+C nach Shift+Drag) und Rechtsklick-Paste im Terminal-View zuverlässig zum Laufen bringen, inklusive Firefox — plus dezenter One-Time-Hint für Shift+Drag.

**Architecture:** Drei kleine, unabhängige Änderungen in `public/index.html`. (1) Cmd+C/Ctrl+C via `term.attachCustomKeyEventHandler()` selbst verdrahten und `term.getSelection()` nach `navigator.clipboard.writeText()` schreiben — nur bei vorhandener Selection, sonst bricht SIGINT. (2) `contextmenu`-Handler in Firefox zum No-Op machen, damit das native Kontextmenü mit seinem „Einfügen" erscheint und das entstehende `paste`-Event über Bubbling vom existierenden Container-Paste-Listener abgefangen wird. (3) Einmaliger Toast beim ersten Terminal-Aufruf mit `localStorage`-Gate.

**Tech Stack:** Vanilla JS, xterm.js (bereits geladen), `navigator.clipboard` API, `localStorage`. Kein Build-Step, keine neuen Dependencies.

---

## Projektspezifika (lies das zuerst)

- **Keine Tests, kein Linter.** Dieses Projekt hat explizit keinen Test-Runner (siehe `CLAUDE.md` → „Kein Build-Step, keine Tests, kein Linter"). Verifikation läuft ausschließlich durch Server-Neustart + manuellen Browser-Test. Baue daher keine Test-Dateien — die Verifikationsschritte in diesem Plan sind manuelle Browser-Interaktionen.
- **Frontend ist eine Single-File SPA.** Alles passiert in `public/index.html`. Inline-JS im `<script>`-Block, keine Imports, keine Module.
- **Server-Restart nach Änderungen.** Der LaunchAgent hält eine alte Version im Speicher. Verwende:
  ```bash
  launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
  ```
  Danach Hard-Reload im Browser (Cmd+Shift+R), sonst zieht der Service-Worker-Cache.
- **showToast-API:** `showToast(msg, type)` wo `type` eins von `'info' | 'success' | 'error'` ist. Default `'info'`. 3.5s Anzeigedauer, keine Custom-Duration — akzeptieren wir.
- **Wo wird editiert:** `public/index.html` rund um den `new Terminal({...})`-Block (aktuell ~Zeile 5098 ff.) und den `contextmenu`-Listener (~Zeile 5145). Zeilennummern können abweichen — such nach den eindeutigen Strings in den Edit-Steps.
- **`term.attachCustomKeyEventHandler`** ist xterm.js-Standard-API. Signatur: `term.attachCustomKeyEventHandler((event: KeyboardEvent) => boolean)`. Rückgabe `false` → xterm unterdrückt seinen eigenen Default-Handler für dieses Event (Keystroke geht NICHT an den PTY). Rückgabe `true` → xterm macht weiter wie gehabt.
- **`navigator.clipboard.writeText()`** braucht secure context (https/localhost) aber **keine** Permission-Bubble. Läuft silent in Firefox/Chrome/Safari auf `code.derremo.xyz` (https) und `localhost:3333`.
- **`navigator.clipboard.readText()`** braucht in Firefox eine Permission-Bubble — das ist der Grund für das Rechtsklick-Problem. In Chrome/Safari läuft's silent aus User-Gesture heraus.
- **Commits häufig und klein.** Jede Task ist ein Commit. Commit-Messages auf Deutsch, angelehnt am Stil der letzten Commits (`git log --oneline -5` zum Stil-Check).

---

## File Structure

Nur eine Datei wird angefasst:

- **Modify:** `public/index.html` — drei Code-Regionen im Terminal-Init-Block. Keine neuen Funktionen, keine neuen DOM-Elemente, keine neuen CSS-Regeln.

Bewusst keine Auslagerung in separate JS-Dateien: das Projekt ist eine Single-File-SPA ohne Build-Step, und die Änderungen sind klein genug, um der etablierten Konvention zu folgen (siehe `CLAUDE.md`).

---

## Task 1: Cmd+C / Ctrl+C auf echtes Clipboard verdrahten

**Files:**
- Modify: `public/index.html` — direkt nach dem `new Terminal({...})`-Block, vor `term.open(container)`.

**Warum zuerst:** Das ist der eigentliche Copy-Fix und hat den höchsten Nutzen. Die anderen beiden Tasks sind Quality-of-Life-Ergänzungen.

- [ ] **Step 1: Aktuellen Zustand lesen**

Öffne `public/index.html` und such nach dem Terminal-Init:
```
grep -n "new Terminal({" public/index.html
```
Erwartet: eine Fundstelle, aktuell bei ~Zeile 5098. Merke dir die tatsächliche Zeile.

Dann lies den Block von `new Terminal({` bis einschließlich `term.open(container);` (wenige Zeilen weiter). Dort wird der Handler eingehängt.

- [ ] **Step 2: `attachCustomKeyEventHandler` zwischen Terminal-Erzeugung und `term.open()` einhängen**

Such nach dieser genauen Zeile in `public/index.html`:

```js
      term.loadAddon(webLinksAddon);
      term.open(container);
```

Ersetze sie durch:

```js
      term.loadAddon(webLinksAddon);

      // Copy-Handling: xterm.js-Selection ist KEINE echte Browser-Selection
      // (wird per Canvas/DOM-Overlay gerendert), darum weiß der Browser nichts
      // davon und Cmd+C/Ctrl+C wäre ohne diesen Handler ein No-Op. Wir fangen
      // das Key-Event nur ab, wenn eine Selection existiert — ohne Selection
      // muss Ctrl+C als SIGINT an den PTY durchgehen, sonst ist das Terminal
      // kaputt (kein Prozess mehr abbrechbar).
      term.attachCustomKeyEventHandler((ev) => {
        if (ev.type !== 'keydown') return true;
        const isCopyCombo = (ev.metaKey || ev.ctrlKey) && !ev.shiftKey && !ev.altKey && ev.key === 'c';
        if (!isCopyCombo) return true;
        if (!term.hasSelection()) return true;   // Ctrl+C ohne Selection → SIGINT
        const text = term.getSelection();
        if (!text) return true;
        navigator.clipboard.writeText(text).catch(() => {
          showToast('Kopieren fehlgeschlagen — Zwischenablage nicht beschreibbar', 'error');
        });
        return false;   // Keystroke NICHT an PTY weitergeben
      });

      term.open(container);
```

- [ ] **Step 3: Server neustarten und Hard-Reload**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

Im Browser: Cmd+Shift+R auf der Hub-Seite.

- [ ] **Step 4: Manuell verifizieren — Copy funktioniert**

In Firefox **und** Chrome auf macOS, jeweils:

1. Öffne eine existierende tmux-Session im Terminal-View (egal welche).
2. Halte **Shift** gedrückt und markiere per Drag ein paar Zeichen (oder eine Zeile) Text im Terminal.
3. Drück **Cmd+C**.
4. Öffne ein anderes Fenster (z.B. den Mac-eigenen Notes/TextEdit) und drück **Cmd+V**.

Erwartet: der markierte Text erscheint. Ohne weitere Permission-Prompts, ohne Toast, ohne Firefox-Popup.

- [ ] **Step 5: Manuell verifizieren — Ctrl+C bleibt SIGINT (kritisch)**

1. Öffne ein Terminal (idealerweise eines mit laufendem Claude oder einem anderen Prozess — notfalls via `tail -f /dev/null` in einer Bash-Session).
2. **Keine Selection** haben (nichts markiert, falls doch → irgendwohin klicken um Selection zu clearen).
3. Drück **Ctrl+C**.

Erwartet: der laufende Prozess wird abgebrochen (wie vorher). Wenn stattdessen nichts passiert → `hasSelection()`-Guard kaputt → Bug, zurück zu Step 2 und Code prüfen.

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "$(cat <<'EOF'
terminal: Cmd+C kopiert xterm-Selection ins OS-Clipboard

xterm.js rendert Selection per Canvas, also ist das keine echte Browser-
Selection — Cmd+C war bisher ein No-Op. attachCustomKeyEventHandler
fängt Cmd+C / Ctrl+C nur bei existierender Selection ab, schreibt via
navigator.clipboard.writeText() und unterdrückt den Keystroke. Ohne
Selection geht Ctrl+C weiterhin als SIGINT an den PTY durch.
EOF
)"
```

---

## Task 2: Rechtsklick-Paste in Firefox ohne Doppel-UI

**Files:**
- Modify: `public/index.html` — existierender `contextmenu`-Listener am Terminal-Container (aktuell ~Zeile 5145).

**Warum:** Firefox zeigt beim Aufruf von `navigator.clipboard.readText()` eine Permission-Bubble mit eigenem „Einfügen"-Button *zusätzlich* zum nativen Kontextmenü. User sieht Doppel-UI. Fix: in Firefox den Handler zum No-Op machen, dann firet Firefox' eigenes Kontextmenü-Paste ein `paste`-Event, das unser existierender Container-Paste-Listener (der bereits da ist) auffängt.

- [ ] **Step 1: Aktuelle `contextmenu`-Stelle finden**

```
grep -n "contextmenu" public/index.html
```

Erwartet: eine Fundstelle im Terminal-Init-Block, aktuell bei ~Zeile 5145 (`container.addEventListener('contextmenu', …`).

- [ ] **Step 2: Firefox-Branch einbauen**

Such nach dieser genauen Zeile in `public/index.html`:

```js
      container.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        try {
          const text = await navigator.clipboard.readText();
          if (text) term.paste(text);
        } catch (err) {
          showToast('Zwischenablage nicht lesbar — bitte Browser-Permission erlauben', 'error');
        }
      });
```

Ersetze sie durch:

```js
      // Firefox erlaubt clipboard.readText() nicht stumm — zeigt stattdessen
      // eine Permission-Bubble mit eigenem „Einfügen"-Button ZUSÄTZLICH zum
      // nativen Kontextmenü. Doppel-UI. Darum: in Firefox den Handler skippen,
      // natives Menü zulassen. Dessen „Einfügen" firet ein paste-Event auf die
      // xterm-helper-textarea, das bubblet zum Container und wird vom bereits
      // existierenden 'paste'-Listener (weiter oben) an term.paste() delegiert.
      // In Chrome/Safari läuft readText() silent aus User-Gesture, da machen
      // wir weiterhin das sofortige Paste ohne Kontextmenü.
      const isFirefox = navigator.userAgent.includes('Firefox');
      if (!isFirefox) {
        container.addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          try {
            const text = await navigator.clipboard.readText();
            if (text) term.paste(text);
          } catch (err) {
            showToast('Zwischenablage nicht lesbar — bitte Browser-Permission erlauben', 'error');
          }
        });
      }
```

- [ ] **Step 3: Restart + Reload**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

Cmd+Shift+R im Browser.

- [ ] **Step 4: Firefox manuell verifizieren**

1. In einem externen Fenster (z.B. Notes/TextEdit) Text markieren und `Cmd+C` drücken.
2. Firefox → Hub öffnen → Terminal-View.
3. Rechtsklick ins Terminal.
4. Natives Firefox-Kontextmenü erscheint (mit Eintrag „Einfügen" o.ä.).
5. „Einfügen" klicken.

Erwartet: der Text aus dem Clipboard landet im Terminal (sichtbar weil Claude/Shell das Echo). **Kein** zweiter Paste-Button oberhalb des Menüs. Keine Permission-Bubble.

- [ ] **Step 5: Chrome manuell verifizieren (Regression)**

1. Gleicher Clipboard-Inhalt wie oben.
2. Chrome → Hub → Terminal-View.
3. Rechtsklick ins Terminal.

Erwartet: **kein** Kontextmenü — der Text wird sofort eingefügt wie vorher. Chrome-Verhalten ist unverändert.

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "$(cat <<'EOF'
terminal: Rechtsklick-Paste in Firefox ohne Doppel-UI

clipboard.readText() triggert in Firefox eine Permission-Bubble, die
parallel zum nativen Kontextmenü einen zweiten „Einfügen"-Button zeigt.
Fix: in Firefox den contextmenu-Handler gar nicht erst registrieren.
Das native Menü-Paste firet dann ein paste-Event, das der bestehende
Container-Paste-Listener via Bubbling an term.paste() delegiert.
Chrome/Safari bleiben unverändert (sofort-Paste ohne Menü).
EOF
)"
```

---

## Task 3: One-Time-Hint für Shift+Drag

**Files:**
- Modify: `public/index.html` — im `connectToSession`-Pfad, dort wo nach `term.open()` der WebSocket geöffnet wird (aktuell ~Zeile 5202, der `requestAnimationFrame`-Block).

**Warum:** Shift+Drag ist die einzige funktionierende Art zu markieren (weil Claude/tmux das Mouse-Tracking greift), aber das weiß niemand intuitiv. Einmaliger dezenter Hint reicht.

- [ ] **Step 1: Stelle finden**

```
grep -n "term.focus();" public/index.html
```

Erwartet: eine Fundstelle im `requestAnimationFrame`-Block nach `term.open()`, aktuell ~Zeile 5219.

- [ ] **Step 2: Hint einbauen**

Such nach dieser genauen Zeile in `public/index.html`:

```js
        currentTerminal = term;
        currentResizeObserver = resizeObserver;
        term.focus();
      });
```

Ersetze sie durch:

```js
        currentTerminal = term;
        currentResizeObserver = resizeObserver;
        term.focus();

        // Einmaliger Hint: Shift+Drag zum Markieren ist nicht intuitiv, weil
        // Claude/tmux Mouse-Tracking aktivieren und damit die normale
        // Client-Selection unterdrücken. Nur zeigen wenn der User den Hint
        // noch nie gesehen hat.
        if (!localStorage.getItem('cchub_hint_copy_seen')) {
          showToast('Tipp: Shift+Drag zum Markieren, Cmd+C kopiert', 'info');
          localStorage.setItem('cchub_hint_copy_seen', '1');
        }
      });
```

- [ ] **Step 3: Restart + Reload**

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

Cmd+Shift+R.

- [ ] **Step 4: Hint erscheint beim ersten Mal — verifizieren**

In einem Browser-Profil, in dem der Hub noch nie offen war (oder via DevTools `localStorage.removeItem('cchub_hint_copy_seen')` clearen):

1. Hub öffnen, Terminal-View betreten.
2. Erwartet: Info-Toast „Tipp: Shift+Drag zum Markieren, Cmd+C kopiert" erscheint.
3. Terminal-View verlassen, nochmal betreten.
4. Erwartet: **kein** Toast mehr.

Als Sanity-Check nochmal clearen:
```js
// In Browser-DevTools-Console:
localStorage.removeItem('cchub_hint_copy_seen')
```
Dann Terminal-View betreten → Toast kommt wieder.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "$(cat <<'EOF'
terminal: One-Time-Hint für Shift+Drag + Cmd+C

Dezenter Info-Toast beim ersten Terminal-Aufruf pro Browser-Profil.
localStorage-Flag 'cchub_hint_copy_seen' verhindert Wiederholung.
Nötig weil Mouse-Tracking (Claude/tmux) die intuitive Maus-Selection
unterdrückt und User nicht raten sollen, wie Markieren eigentlich geht.
EOF
)"
```

---

## Task 4: Finale Sweep-Verifikation

**Files:** keine Änderungen — reine Verifikation aller drei Features im Zusammenspiel.

- [ ] **Step 1: Firefox End-to-End**

1. Terminal-View öffnen (frisches Profil oder localStorage gecleart).
2. Toast „Tipp: Shift+Drag …" erscheint. ✓
3. Shift+Drag → Text markieren. Selection bleibt sichtbar. ✓
4. Cmd+C → in TextEdit Cmd+V → Text erscheint. ✓
5. In TextEdit anderen Text markieren + Cmd+C.
6. Zurück ins Terminal → Rechtsklick → natives Firefox-Menü → „Einfügen" → Text landet im Terminal. ✓ Kein doppelter Paste-Button.
7. Ohne Selection Ctrl+C drücken → laufender Prozess wird unterbrochen (SIGINT). ✓

- [ ] **Step 2: Chrome End-to-End**

1. Gleicher Durchlauf.
2. Unterschied Rechtsklick: Chrome zeigt **kein** Menü, sondern fügt sofort ein. ✓
3. Alles andere identisch.

- [ ] **Step 3: Regression-Check Scroll**

Nachdem wir Key-Handling angefasst haben — ein Quick-Check, dass wir nichts Nicht-Verwandtes kaputt gemacht haben:

1. Terminal mit viel Output öffnen (z.B. `ls -la /usr/bin`).
2. Per Maus-Wheel scrollen → tmux scrollt wie gewohnt.
3. Normale Tastatureingaben (Pfeiltasten, Tippen) funktionieren unverändert.

- [ ] **Step 4: Tipp-Hint-Reset für „Produktions"-Release**

Da du der einzige User bist und den Hint beim Testen bereits gesehen hast — entscheide:
- Wenn du willst, dass der Hint beim nächsten „echten" Öffnen nochmal kommt, in der Browser-DevTools-Console: `localStorage.removeItem('cchub_hint_copy_seen')`.
- Sonst nichts tun.

Dies ist kein Code-Schritt, nur eine bewusste User-Entscheidung am Ende.

- [ ] **Step 5: Abschluss-Commit (nur wenn nötig)**

Falls Step 1-3 einen Fehler aufdecken, zurück zum betroffenen Task. Falls alles grün: **kein** Commit nötig, Task 4 war reine Verifikation. Dann zurück zum Haupt-Branch mergen bzw. pushen (userseitige Entscheidung, nicht im Scope des Plans).

---

## Self-Review-Notizen (bereits erledigt)

**Spec-Coverage:**
- Spec-Fix 1 (Cmd+C selbst implementieren) → Task 1 ✓
- Spec-Fix 2 (Rechtsklick Firefox-aware) → Task 2 ✓
- Spec-Fix 3 (One-Time-Hint) → Task 3 ✓
- Kritischer Testfall „Ctrl+C ohne Selection muss SIGINT senden" → Task 1 Step 5 ✓
- Auto-Copy ist NICHT im Plan (im Spec als Nicht-Ziel geführt) ✓

**Placeholder-Scan:** Keine „TBD"/„implement later"/„handle edge cases". Alle Code-Blöcke vollständig.

**Type-Consistency:** `hasSelection()`, `getSelection()`, `attachCustomKeyEventHandler`, `showToast(msg, type)`, `localStorage.getItem/setItem` — alle Signaturen mit der tatsächlichen xterm.js- bzw. Projekt-Realität abgeglichen (`showToast` in `public/index.html:5751`).
