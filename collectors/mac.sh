#!/usr/bin/env bash
# Foreground look → Daymeter ingest. Run every 1–2 minutes (launchd plist alongside).
# Remembers the last look so the next POST can send an honest duration.
set -euo pipefail

URL="${DAYMETER_INGEST_URL:-http://127.0.0.1:5173/api/ingest}"
TOKEN="${DAYMETER_INGEST_TOKEN:-}"
DEVICE="${DAYMETER_DEVICE:-mac}"
STATE_DIR="${DAYMETER_STATE_DIR:-$HOME/.daymeter}"
STATE_FILE="$STATE_DIR/last-look.json"
IDLE_CAP_SEC="${DAYMETER_IDLE_CAP_SEC:-180}"

mkdir -p "$STATE_DIR"

idle_sec="$(
  ioreg -c IOHIDSystem -d 4 -r 2>/dev/null | python3 -c '
import sys
text = sys.stdin.read()
for line in text.splitlines():
    if "HIDIdleTime" in line:
        digits = "".join(ch for ch in line.split("=")[-1] if ch.isdigit())
        if digits:
            print(int(int(digits) / 1_000_000_000))
            raise SystemExit
print(0)
'
)"

app="$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null || true)"
app="${app:-unknown}"

title=""
url=""
bundle="$(osascript -e 'tell application "System Events" to get bundle identifier of first application process whose frontmost is true' 2>/dev/null || true)"
lower="$(printf '%s' "$app" | tr '[:upper:]' '[:lower:]')"

browser_osascript() {
  local tell="$1"
  title="$(osascript -e "tell application \"$tell\" to get title of active tab of front window" 2>/dev/null || true)"
  url="$(osascript -e "tell application \"$tell\" to get URL of active tab of front window" 2>/dev/null || true)"
}

case "$lower" in
  *google chrome*|*chrome*|*chromium*|*comet*)
    browser_osascript "Google Chrome"
    bundle="com.google.Chrome"
    ;;
  *brave*)
    browser_osascript "Brave Browser"
    bundle="com.brave.Browser"
    ;;
  *microsoft edge*|*edge*)
    browser_osascript "Microsoft Edge"
    bundle="com.microsoft.edgemac"
    ;;
  *safari*)
    title="$(osascript -e 'tell application "Safari" to get name of front document' 2>/dev/null || true)"
    url="$(osascript -e 'tell application "Safari" to get URL of front document' 2>/dev/null || true)"
    bundle="com.apple.Safari"
    ;;
  *arc*)
    browser_osascript "Arc"
    bundle="company.thebrowser.Browser"
    ;;
  *firefox*)
    title="$(osascript -e 'tell application "Firefox" to get name of front window' 2>/dev/null || true)"
    bundle="org.mozilla.firefox"
    ;;
esac

ts="$(date +%Y-%m-%dT%H:%M:%S%z)"
payload="$(IDLE_CAP_SEC="$IDLE_CAP_SEC" IDLE_SEC="$idle_sec" python3 - "$ts" "$DEVICE" "$app" "$title" "$url" "$bundle" "$STATE_FILE" <<'PY'
import json, os, sys
from datetime import datetime

ts, device, app, title, url, bundle, state_file = sys.argv[1:]
idle = int(os.environ.get("IDLE_SEC") or "0")
idle_cap = int(os.environ.get("IDLE_CAP_SEC") or "180")

def parse_ts(stamp: str) -> float:
    stamp = stamp.strip()
    if stamp.endswith("Z"):
        stamp = stamp[:-1] + "+00:00"
    if len(stamp) >= 5 and stamp[-5] in "+-" and ":" not in stamp[-5:]:
        stamp = stamp[:-2] + ":" + stamp[-2:]
    return datetime.fromisoformat(stamp).timestamp()

now = parse_ts(ts)
prev = None
try:
    with open(state_file, encoding="utf-8") as f:
        prev = json.load(f)
except Exception:
    prev = None

rows = []
if prev and prev.get("ts") and prev.get("app") and not prev.get("idle"):
    try:
        gap = max(0.0, now - parse_ts(prev["ts"]))
    except Exception:
        gap = 0.0
    seconds = min(gap, float(idle_cap))
    if idle >= idle_cap:
        seconds = 0.0
    if seconds >= 1:
        row = {k: v for k, v in prev.items() if k != "idle"}
        row["seconds"] = round(seconds, 3)
        row["end"] = ts
        rows.append(row)

current = {"ts": ts, "device": device, "app": app}
if title:
    current["title"] = title
if url:
    current["url"] = url
if bundle:
    current["bundle"] = bundle
if idle < idle_cap:
    rows.append(current)
    save = current
else:
    save = {"ts": ts, "device": device, "app": app, "idle": True}

os.makedirs(os.path.dirname(state_file) or ".", exist_ok=True)
with open(state_file, "w", encoding="utf-8") as f:
    json.dump(save, f)

if not rows:
    print(json.dumps({"ok": False, "skipped": "idle"}))
elif len(rows) == 1:
    print(json.dumps(rows[0]))
else:
    print(json.dumps({"device": device, "samples": rows}))
PY
)"

if printf '%s' "$payload" | grep -q '"skipped": "idle"'; then
  echo "idle ${idle_sec}s — not posting"
  exit 0
fi

headers=(-H "Content-Type: application/json")
if [[ -n "$TOKEN" ]]; then
  headers+=(-H "x-daymeter-token: $TOKEN")
fi

curl -sS -X POST "$URL" "${headers[@]}" -d "$payload"
echo
