# Claude Code Hub

Web-Interface zum Verwalten und Fernsteuern von Claude Code Sessions auf deinem Mac mini —
erreichbar per Browser, auch vom iPhone aus.

![Claude Code Hub Screenshot](screenshot.png)

---

## Was macht das?

Claude Code Hub ist ein kleiner Server, der auf deinem Mac mini läuft. Er zeigt dir alle laufenden Claude Code Sessions in einem Dashboard und lässt dich per Browser ins Terminal einsteigen — von deinem Mac, iPad oder iPhone aus, auch über das Internet.

**Features:**
- Dashboard mit allen Sessions und Live-Status
- Terminal im Browser (vollständig, mit Farben)
- Sessions starten, verbinden, beenden
- Projekt-Verwaltung mit Roadmap-Ansicht
- Usage-Tracking (Kosten, Token, 5h-Limit)
- PWA — als App auf dem iPhone-Homescreen installierbar
- Auto-Start nach Reboot via macOS LaunchAgent

---

## Voraussetzungen

Du brauchst diese Programme auf deinem Mac mini, bevor du anfängst:

### 1. Xcode Command Line Tools

Öffne das Terminal (Programme → Dienstprogramme → Terminal) und tippe:

```bash
xcode-select --install
```

Ein Fenster öffnet sich — auf „Installieren" klicken und warten (ca. 5 Minuten).

### 2. Homebrew

Homebrew ist ein Paketmanager für macOS. Installiere ihn mit:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Nach der Installation erscheint am Ende eine Meldung wie:

```
==> Next steps:
    Run these commands in your terminal:
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
```

Diese zwei Zeilen genau so ausführen (copy-paste).

Prüfe ob es funktioniert hat:

```bash
brew --version
# sollte ausgeben: Homebrew 4.x.x
```

### 3. Node.js

```bash
brew install node
node --version
# sollte ausgeben: v20.x.x oder neuer
```

### 4. Claude Code CLI

Das ist die eigentliche Claude-Kommandozeile, die der Hub verwaltet:

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

Falls `claude` nach der Installation nicht gefunden wird:

```bash
export PATH="$HOME/.local/bin:$PATH"
# Diese Zeile auch in ~/.zprofile eintragen damit sie nach Neustart bleibt:
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zprofile
```

Dann einmalig `claude` starten und den Anweisungen folgen (Anthropic-Account verbinden).

---

## Installation

### Repo herunterladen

```bash
cd ~
git clone https://github.com/DerRemo/claud-code-hub.git
cd claud-code-hub
```

### Setup ausführen

```bash
chmod +x setup.sh
./setup.sh
```

Das Script macht alles automatisch:

1. Prüft ob Node.js und tmux vorhanden sind (installiert tmux falls nötig)
2. Installiert die npm-Abhängigkeiten
3. Erstellt eine `.env`-Datei mit einem zufälligen Auth-Token
4. Richtet einen LaunchAgent ein (Server startet automatisch nach Reboot)
5. Startet den Server

Am Ende siehst du so etwas:

```
  ✓ Claude Code Hub läuft!

  Lokal:   http://localhost:3333
```

> **Wichtig:** Das Setup zeigt dir einmalig dein Auth-Token. Notiere es — du brauchst es für den Browser-Zugriff. Du kannst es jederzeit wieder nachschauen mit:
> ```bash
> grep AUTH_TOKEN ~/claud-code-hub/.env
> ```

---

## Erster Zugriff

Öffne im Browser auf demselben Mac:

```
http://localhost:3333
```

Beim ersten Besuch fragt der Browser nach dem Token — das ist der Wert aus `AUTH_TOKEN` in deiner `.env`. Nach einmaliger Eingabe wird er im Browser gespeichert.

---

## Remote-Zugriff über Cloudflare Tunnel (optional)

Wenn du den Hub auch von außerhalb deines Heimnetzwerks erreichen willst (iPhone unterwegs, anderer Rechner), kannst du Cloudflare Tunnel einrichten. Das ist kostenlos.

### Cloudflare-Account und Domain

Du brauchst einen kostenlosen Account auf [cloudflare.com](https://cloudflare.com) und eine Domain, die du dort verwaltest. Eine `.xyz`-Domain kostet ca. 1 €/Jahr.

### cloudflared installieren

```bash
brew install cloudflared
```

### Tunnel erstellen

```bash
cloudflared tunnel login
cloudflared tunnel create claude-hub
```

Der zweite Befehl gibt eine Tunnel-ID aus (sieht so aus: `abc123de-...`). Notiere sie.

### DNS-Eintrag anlegen

```bash
cloudflared tunnel route dns claude-hub code.DEINE-DOMAIN.xyz
```

### Tunnel-Konfiguration

Erstelle die Datei `~/.cloudflared/config.yml`:

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Inhalt (ersetze `TUNNEL-ID` und `DEINE-DOMAIN.xyz`):

```yaml
tunnel: TUNNEL-ID
credentials-file: /Users/DEIN-USERNAME/.cloudflared/TUNNEL-ID.json

ingress:
  - hostname: code.DEINE-DOMAIN.xyz
    service: http://localhost:3333
  - service: http_status:404
```

Speichern mit `Ctrl+O`, `Enter`, `Ctrl+X`.

### Tunnel als LaunchAgent einrichten

```bash
cloudflared service install
launchctl start com.cloudflare.cloudflared
```

Ab jetzt ist der Hub unter `https://code.DEINE-DOMAIN.xyz` erreichbar.

---

## Konfiguration

Alle Einstellungen stehen in `~/claud-code-hub/.env`:

| Variable | Standard | Beschreibung |
|---|---|---|
| `PORT` | `3333` | Port des Servers |
| `AUTH_TOKEN` | — | Pflichtfeld, wird von setup.sh generiert |
| `SESSION_PREFIX` | `cc-` | Prefix für neue Session-Namen |
| `DEFAULT_PROJECT_DIR` | `~` | Standard-Verzeichnis für neue Sessions |
| `TMUX_PATH` | `/opt/homebrew/bin/tmux` | Pfad zum tmux-Binary |
| `PROJECT_ROOTS` | `~/Projects` | Verzeichnisse für die Projekt-Erkennung (kommagetrennt) |

Nach Änderungen an `.env` muss der Server neu gestartet werden:

```bash
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

---

## Server verwalten

```bash
# Status prüfen
launchctl list | grep claude-code-hub

# Server neu starten (z.B. nach Code-Änderungen)
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub

# Server stoppen
launchctl bootout gui/$(id -u) ~/claud-code-hub/com.derremo.claude-code-hub.plist

# Logs live verfolgen
tail -f ~/claud-code-hub/logs/stdout.log
tail -f ~/claud-code-hub/logs/stderr.log
```

---

## Updates

```bash
cd ~/claud-code-hub
git pull
npm install
launchctl kickstart -k gui/$(id -u)/com.derremo.claude-code-hub
```

---

## Fehlerbehebung

### „Port 3333 bereits belegt"

Ein anderer Prozess nutzt den Port. Prüfen und beenden:

```bash
lsof -i :3333
kill -9 <PID aus der Ausgabe>
```

### Hub startet nicht nach Reboot

LaunchAgent neu laden:

```bash
launchctl bootout gui/$(id -u) ~/claud-code-hub/com.derremo.claude-code-hub.plist
launchctl bootstrap gui/$(id -u) ~/claud-code-hub/com.derremo.claude-code-hub.plist
```

### `claude`-Befehl nicht gefunden im Terminal

```bash
echo 'export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
```

### Token vergessen

```bash
grep AUTH_TOKEN ~/claud-code-hub/.env
```

### Tmux-Socket fehlt

Einmalig eine tmux-Session starten damit der Socket angelegt wird:

```bash
tmux new-session -d -s init
```

---

## Stack

- **Backend:** Node.js + Express + express-ws + node-pty
- **Frontend:** Vanilla JS + xterm.js (kein Build-Step)
- **Sessions:** tmux
- **Remote:** Cloudflare Tunnel
