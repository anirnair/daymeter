# Daymeter Writer (Android)

Sideload APK. Same `applicationId` (`com.daymeter.writer`) as the installed app, so this is an upgrade.

**1.2.0** posts timed sessions, not just a day total.

## What it sends

Every ~15 minutes (and on **Write + upload now**) it POSTs JSON to:

- `https://daymeter.vercel.app/api/ingest` (hour grid)
- Origin `…/api/ingest/phone` (backup totals)

```json
{
  "device": "phone",
  "day": "2026-09-15",
  "hours": 4.29,
  "top": ["com.whatsapp"],
  "switches": 210,
  "sessions": [
    {
      "ts": "2026-09-15T09:00:02+0530",
      "end": "2026-09-15T09:04:12+0530",
      "app": "com.whatsapp",
      "seconds": 250,
      "className": "com.whatsapp.HomeActivity"
    }
  ],
  "source": "writer"
}
```

Sessions come from `UsageStatsManager.queryEvents`: types **1 / 23** start, **2 / 24 / 25 / 26** end, **16 / 17 / 28** screen off. An open foreground at the end of “now” is closed at the query window so today is not empty. If events are missing, hours still fall back to `queryUsageStats`.

## Build

Needs Android SDK 35 + JDK 17.

```bash
cd writer/android
./gradlew :app:assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../DaymeterWriter-debug.apk
```

Grant **Usage access**, then tap write once so the first session payload leaves the phone.
