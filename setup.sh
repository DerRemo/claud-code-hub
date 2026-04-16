#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────
# Claude Code Hub — Setup Script für Mac mini
# ─────────────────────────────────────────────────────────────

BOLD="\033[1m"
TEAL="\033[38;5;43m"
DIM="\033[2m"
RESET="\033[0m"

echo ""
echo -e "${TEAL}${BOLD}  ⚡ Claude Code Hub — Setup${RESET}"
echo -e "${DIM}  ─────────────────────────────────────${RESET}"
echo ""

# 1. Check prerequisites
echo -e "${BOLD}[1/7]${RESET} Prüfe Voraussetzungen..."

if ! command -v node &> /dev/null; then
  echo "  ✕ Node.js nicht gefunden. Installiere mit: brew install node"
  exit 1
fi
echo "  ✓ Node.js $(node -v)"

if ! command -v tmux &> /dev/null; then
  echo "  ⚙ tmux wird installiert..."
  brew install tmux
fi
echo "  ✓ tmux $(tmux -V)"

# 2. Install dependencies
echo ""
echo -e "${BOLD}[2/7]${RESET} Installiere Abhängigkeiten..."
npm install

# 3. Configure .env
echo ""
echo -e "${BOLD}[3/7]${RESET} Konfiguration..."

if [ ! -f .env ]; then
  TOKEN=$(openssl rand -hex 32)
  cp .env.example .env
  sed -i '' "s/^AUTH_TOKEN=$/AUTH_TOKEN=${TOKEN}/" .env
  echo -e "  ✓ .env erstellt mit Auth-Token"
  echo ""
  echo -e "  ${TEAL}${BOLD}⚠ WICHTIG: Merke dir dieses Token:${RESET}"
  echo -e "  ${DIM}${TOKEN}${RESET}"
  echo ""
  echo -e "  Du brauchst es für den Zugriff über Cloudflare Tunnel."
else
  echo "  ✓ .env existiert bereits"
fi

# 4. Create LaunchAgent for auto-start
echo ""
echo -e "${BOLD}[4/7]${RESET} LaunchAgent einrichten..."

PLIST_DIR="$HOME/Library/LaunchAgents"
LAUNCHAGENT_ID="${LAUNCHAGENT_ID:-com.claude-code-hub}"
PLIST_FILE="$PLIST_DIR/${LAUNCHAGENT_ID}.plist"
APP_DIR="$(pwd)"

mkdir -p "$PLIST_DIR"

cat > "$PLIST_FILE" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHAGENT_ID}</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(which node)</string>
    <string>${APP_DIR}/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${APP_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${APP_DIR}/logs/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${APP_DIR}/logs/stderr.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <!--
      PATH bewusst minimal. server.js ergänzt ~/.local/bin, /opt/homebrew/bin
      und /usr/local/bin zur Laufzeit, damit Kinderprozesse von tmux (z.B.
      \`claude\` in ~/.local/bin) gefunden werden. Wer das plist anpasst:
      dieselbe Ergänzung dort manuell einbauen, sonst greift der Server-
      Fallback nicht mehr.
    -->
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <!-- UTF-8-Locale setzen, sonst läuft der gespawnte Express-Server und
         damit auch alle tmux-Subcommands im C/POSIX-Modus. Für die
         WS-Terminal-Pipeline setzen wir das zusätzlich noch explizit in
         server.js, aber hier ist es die konsistentere Default-Stelle. -->
    <key>LANG</key>
    <string>en_US.UTF-8</string>
    <key>LC_CTYPE</key>
    <string>en_US.UTF-8</string>
  </dict>
</dict>
</plist>
PLIST

chmod 644 "$PLIST_FILE"

mkdir -p "${APP_DIR}/logs"

echo "  ✓ LaunchAgent erstellt: $PLIST_FILE"

# 5. Claude-Code Hook-Installation
echo ""
echo -e "${BOLD}[5/7]${RESET} Claude-Code Hooks installieren..."

SETTINGS_FILE="$HOME/.claude/settings.json"
if ! command -v jq &> /dev/null; then
  echo -e "  ${DIM}⚠ jq nicht gefunden — überspringe Hook-Install.${RESET}"
  echo -e "  ${DIM}  Installiere jq und re-run setup.sh, oder pflege die Hooks manuell.${RESET}"
  echo -e "  ${DIM}  (siehe README.md → Notifications / Hook-Setup)${RESET}"
else
  mkdir -p "$HOME/.claude"
  [ -f "$SETTINGS_FILE" ] || echo "{}" > "$SETTINGS_FILE"

  # Events die der Hub konsumiert. Jeder Event bekommt denselben curl-
  # Payload: POST an /api/hooks/:event mit Auth + Session-Header.
  HOOK_EVENTS=(UserPromptSubmit Stop SubagentStop Notification SessionStart SessionEnd)

  # Sentinel-Marker pro Entry, damit Re-Runs nur Hub-Einträge ersetzen
  # und niemals User-eigene Hooks löschen.
  HOOK_CMD='curl -fsS -m 2 -X POST "$CC_HUB_URL/api/hooks/EVENT_NAME" -H "Authorization: Bearer $CC_HUB_TOKEN" -H "X-CC-Hub-Session: $CC_HUB_SESSION" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1 || true'

  TMP=$(mktemp)
  cp "$SETTINGS_FILE" "$TMP"

  for evt in "${HOOK_EVENTS[@]}"; do
    cmd="${HOOK_CMD//EVENT_NAME/$evt}"
    jq --arg evt "$evt" --arg cmd "$cmd" '
      .hooks //= {}
      | .hooks[$evt] //= []
      # Bestehende Hub-Einträge (_owner:"claude-code-hub") entfernen
      | .hooks[$evt] |= map(select(
          (.hooks // [] | map(._owner // "") | any(. == "claude-code-hub")) | not
        ))
      # Neuen Eintrag anhängen
      | .hooks[$evt] += [{
          matcher: "",
          hooks: [{ type: "command", command: $cmd, _owner: "claude-code-hub" }]
        }]
    ' "$TMP" > "$TMP.new" && mv "$TMP.new" "$TMP"
  done

  mv "$TMP" "$SETTINGS_FILE"
  echo "  ✓ Hooks geschrieben nach $SETTINGS_FILE"
  echo -e "  ${DIM}  (${#HOOK_EVENTS[@]} Events: ${HOOK_EVENTS[*]})${RESET}"
fi

# 6. StatusLine-Script — Hub-Reporting
echo ""
echo -e "${BOLD}[6/7]${RESET} StatusLine-Script einrichten..."

SL_SCRIPT="$HOME/.claude/statusline-command.sh"
SL_SENTINEL_START="#CCH-SL-START#"
SL_SENTINEL_END="#CCH-SL-END#"

SL_BLOCK='
# ── Claude Code Hub StatusLine Reporting ── #CCH-SL-START#
# Sends rate-limit + cost data to the Hub. Throttled: only on value change or every 60s.
if [ -n "$CC_HUB_URL" ] && [ -n "$CC_HUB_TOKEN" ] && [ -n "$CC_HUB_SESSION" ]; then
  _sl_session_id=$(echo "$input" | jq -r '"'"'.session_id // empty'"'"')
  _sl_state_file="/tmp/cc-hub-sl-${_sl_session_id:-unknown}.state"
  _sl_cost=$(echo "$input" | jq -r '"'"'.cost.total_cost_usd // empty'"'"')
  _sl_current="${five_hour}:${seven_day}:${_sl_cost}"
  _sl_last=""
  _sl_last_ts=0
  if [ -f "$_sl_state_file" ]; then
    _sl_last=$(head -1 "$_sl_state_file" 2>/dev/null | cut -d'"'"'|'"'"' -f1)
    _sl_last_ts=$(head -1 "$_sl_state_file" 2>/dev/null | cut -d'"'"'|'"'"' -f2)
  fi
  _sl_now=$(date +%s)
  _sl_elapsed=$(( _sl_now - ${_sl_last_ts:-0} ))

  if [ "$_sl_current" != "$_sl_last" ] || [ "$_sl_elapsed" -ge 60 ]; then
    _sl_payload=$(echo "$input" | jq -c '"'"'{rate_limits, cost, context_window, model}'"'"')
    curl -fsS -m 2 -X POST "$CC_HUB_URL/api/hooks/statusline" \
      -H "Authorization: Bearer $CC_HUB_TOKEN" \
      -H "X-CC-Hub-Session: $CC_HUB_SESSION" \
      -H "Content-Type: application/json" \
      -d "$_sl_payload" >/dev/null 2>&1 &
    printf '"'"'%s|%s\n'"'"' "$_sl_current" "$_sl_now" > "$_sl_state_file"
  fi
fi
# ── End Claude Code Hub StatusLine Reporting ── #CCH-SL-END#'

if [ -f "$SL_SCRIPT" ]; then
  if grep -q "$SL_SENTINEL_START" "$SL_SCRIPT"; then
    # Replace existing block between sentinels
    TMP_SL=$(mktemp)
    sed "/$SL_SENTINEL_START/,/$SL_SENTINEL_END/d" "$SL_SCRIPT" > "$TMP_SL"
    echo "$SL_BLOCK" >> "$TMP_SL"
    mv "$TMP_SL" "$SL_SCRIPT"
    chmod +x "$SL_SCRIPT"
    echo "  ✓ StatusLine-Reporting-Block aktualisiert in $SL_SCRIPT"
  else
    # Append block
    echo "$SL_BLOCK" >> "$SL_SCRIPT"
    echo "  ✓ StatusLine-Reporting-Block angehängt an $SL_SCRIPT"
  fi
else
  echo -e "  ${DIM}⚠ $SL_SCRIPT nicht gefunden — überspringe.${RESET}"
  echo -e "  ${DIM}  StatusLine-Reporting erfordert ein konfiguriertes statusline-command.sh.${RESET}"
fi

# 7. Load and start
echo ""
echo -e "${BOLD}[7/7]${RESET} Starte Claude Code Hub..."

# Vorherige Version (auch unter altem com.derremo-Namen) entladen
launchctl bootout gui/$(id -u) "$PLIST_FILE" 2>/dev/null || true
if [ "$LAUNCHAGENT_ID" != "com.derremo.claude-code-hub" ]; then
  launchctl bootout gui/$(id -u) "$PLIST_DIR/com.derremo.claude-code-hub.plist" 2>/dev/null || true
fi
launchctl bootstrap gui/$(id -u) "$PLIST_FILE"

echo ""
echo -e "${TEAL}${BOLD}  ✓ Claude Code Hub läuft!${RESET}"
echo ""
PORT="${PORT:-$(grep '^PORT=' .env 2>/dev/null | cut -d= -f2)}"
PORT="${PORT:-3333}"
echo -e "  Lokal:   ${BOLD}http://localhost:${PORT}${RESET}"
echo ""
echo -e "${DIM}  Nächster Schritt: Cloudflare Tunnel einrichten${RESET}"
echo -e "${DIM}  für Remote-Zugriff (optional)${RESET}"
echo ""
