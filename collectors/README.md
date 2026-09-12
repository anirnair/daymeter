# Daymeter collectors

The dashboard polls `/api/live` every 60s. When that route is missing, it still pulls Writer from Origin dashboard11 (CORS is already open there). A few minutes of lag is the point — not another frozen GitHub copy.

Production:

```
POST https://daymeter.vercel.app/api/ingest
Header: x-daymeter-token: $DAYMETER_INGEST_TOKEN
```

Local Vite writes `dashboard/.data/live.json` (gitignored). Token is optional unless `DAYMETER_INGEST_TOKEN` is set.

## Computer look

```json
{
  "ts": "2026-09-12T21:18:02+0530",
  "device": "mac",
  "app": "Google Chrome",
  "title": "Daymeter pull request",
  "url": "https://github.com/anirnair/daymeter",
  "bundle": "com.google.Chrome"
}
```

`device` should be `mac`, `msi` / `windows`, or `phone` / `android`. IST offsets (`+0530`) match the existing log.

## Phone — accurate, granular

Writer’s current dump is a **day-summary** (`hours`, `top`, `switches`). Keep sending that so the mix doesn’t go blank. It cannot sit on the hour grid.

For clocks, also POST sessions from Usage Access:

```json
{
  "device": "phone",
  "sessions": [
    {
      "ts": "2026-09-12T00:10:02+0530",
      "end": "2026-09-12T00:10:42+0530",
      "app": "com.whatsapp",
      "seconds": 40
    }
  ]
}
```

Seconds win over gap estimates. Those looks get a Phone lane, hour cells, and per-app bars.

Until Writer is retargeted, you can POST the same JSON from Termux / Tasker, or pipe `adb shell dumpsys usagestats` through a small converter. The installed APK still talks to Origin dashboard 9 — leave that up. The dashboard pulls that Origin strip so the **reported** line stays current; POSTing sessions here is what puts Phone on the hour grid.

Writer summary (still accepted):

```json
{
  "device": "phone",
  "day": "2026-09-12",
  "hours": 0.28,
  "top": ["com.whatsapp", "com.instagram.android"],
  "switches": 126
}
```

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

When Chrome, Safari, Arc, or Chromium is frontmost, the script also sends the front tab title and URL.

## MSI / Windows

Run `collectors/windows.ps1` every minute via Task Scheduler (hidden, at logon). It sends the foreground process and window title.

## Honesty

- A missed POST is a blank, not idle time.
- Do not invent samples to fill gaps.
- Phone summaries are reported; phone sessions are sampled. The dashboard keeps that distinction.
