# Daymeter collectors

The dashboard polls `/api/live` every 60s. When that route is missing, it still pulls Writer from Origin dashboard11 (CORS is already open there). A few minutes of lag is the point — not another frozen GitHub copy.

Production:

```
POST https://daymeter.vercel.app/api/ingest
Header: x-daymeter-token: $DAYMETER_INGEST_TOKEN
    (Writer also sends x-daymeter-secret / Bearer with the APK secret)
```

Local Vite writes `dashboard/.data/live.json` (gitignored). Token is optional unless `DAYMETER_INGEST_TOKEN` is set.

## Computer look (Mac / MSI)

Each poll remembers the previous look and POSTs it **closed** with `seconds` and `end` (capped at 180s idle). Idle ≥ 180s is not posted as screen time.

```json
{
  "ts": "2026-09-15T21:18:02+0530",
  "device": "mac",
  "app": "Google Chrome",
  "title": "Daymeter pull request",
  "url": "https://github.com/anirnair/daymeter",
  "bundle": "com.google.Chrome",
  "seconds": 58.2,
  "end": "2026-09-15T21:19:00+0530"
}
```

`device` should be `mac`, `msi` / `windows`, or `phone` / `android`. IST offsets (`+0530`) match the existing log.

Mac also sends the frontmost bundle id, plus browser tab title/URL (Chrome, Brave, Edge, Safari, Arc, Firefox). MSI sends window title, optional URL from the process command line, and the exe path as `bundle`.

## Phone — timed sessions (Writer 1.2)

Writer 1.2 POSTs UsageEvents sessions to live ingest **and** Origin. Keep the day-summary (`hours`, `top`, `switches`) so the mix doesn’t go blank when events are thin.

```json
{
  "device": "phone",
  "day": "2026-09-15",
  "hours": 4.29,
  "top": ["com.whatsapp", "com.instagram.android"],
  "switches": 210,
  "sessions": [
    {
      "ts": "2026-09-15T00:10:02+0530",
      "end": "2026-09-15T00:10:42+0530",
      "app": "com.whatsapp",
      "seconds": 40,
      "className": "com.whatsapp.HomeActivity"
    }
  ]
}
```

Seconds win over gap estimates. Those looks get a Phone lane, hour cells, and per-app bars.

Until the upgraded APK is installed, POST the same JSON from Termux / Tasker, or pipe UsageEvents:

```bash
adb shell dumpsys usagestats | python3 collectors/phone-dumpsys.py
# or POST the raw dump
adb shell dumpsys usagestats | curl -sS -X POST https://daymeter.vercel.app/api/ingest \
  -H "Content-Type: text/plain" --data-binary @-
```

Foreground without a later pause is dropped in dumpsys (a gap is missing, not idle). Writer closes the still-open app at “now” so today is not empty.

## Mac

```bash
export DAYMETER_INGEST_URL=https://daymeter.vercel.app/api/ingest
export DAYMETER_INGEST_TOKEN=...
./collectors/mac.sh
```

Install a 1-minute interval:

```bash
mkdir -p ~/Library/LaunchAgents
# copy collectors/com.daymeter.mac.plist, then
launchctl load ~/Library/LaunchAgents/com.daymeter.mac.plist
```

State file: `~/.daymeter/last-look.json`.

## MSI / Windows

Run `collectors/windows.ps1` every minute via Task Scheduler (hidden, at logon). State file: `%LOCALAPPDATA%\daymeter\last-look.json`.

## Honesty

- A missed POST is a blank, not idle time.
- Do not invent samples to fill gaps.
- Phone summaries are reported; phone sessions are sampled. The dashboard keeps that distinction.
