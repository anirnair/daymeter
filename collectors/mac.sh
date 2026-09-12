#!/usr/bin/env bash
# Foreground look → Daymeter ingest. Run every 1–2 minutes (launchd plist alongside).
set -euo pipefail

URL="${DAYMETER_INGEST_URL:-http://127.0.0.1:5173/api/ingest}"
TOKEN="${DAYMETER_INGEST_TOKEN:-}"
DEVICE="${DAYMETER_DEVICE:-mac}"

app="$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null || true)"
app="${app:-unknown}"

title=""
url=""
bundle=""

case "$(printf '%s' "$app" | tr '[:upper:]' '[:lower:]')" in
  *chrome*|*chromium*|*comet*)
    title="$(osascript -e 'tell application "Google Chrome" to get title of active tab of front window' 2>/dev/null || true)"
    url="$(osascript -e 'tell application "Google Chrome" to get URL of active tab of front window' 2>/dev/null || true)"
    bundle="com.google.Chrome"
    ;;
  *safari*)
    title="$(osascript -e 'tell application "Safari" to get name of front document' 2>/dev/null || true)"
    url="$(osascript -e 'tell application "Safari" to get URL of front document' 2>/dev/null || true)"
    bundle="com.apple.Safari"
    ;;
  *arc*)
    title="$(osascript -e 'tell application "Arc" to get title of active tab of front window' 2>/dev/null || true)"
    url="$(osascript -e 'tell application "Arc" to get URL of active tab of front window' 2>/dev/null || true)"
    bundle="company.thebrowser.Browser"
    ;;
esac

ts="$(date +%Y-%m-%dT%H:%M:%S%z)"
payload="$(python3 - "$ts" "$DEVICE" "$app" "$title" "$url" "$bundle" <<'PY'
import json, sys
ts, device, app, title, url, bundle = sys.argv[1:]
row = {"ts": ts, "device": device, "app": app}
if title: row["title"] = title
if url: row["url"] = url
if bundle: row["bundle"] = bundle
print(json.dumps(row))
PY
)"

headers=(-H "Content-Type: application/json")
if [[ -n "$TOKEN" ]]; then
  headers+=(-H "x-daymeter-token: $TOKEN")
fi

curl -sS -X POST "$URL" "${headers[@]}" -d "$payload"
echo
