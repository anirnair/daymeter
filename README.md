# Daymeter

A quiet picture of **where attention sat across a day** — Mac, Windows laptop (MSI), and phone — without turning it into a score.

This GitHub repo is the durable home for that picture: what it is, the design choices that stuck, and the actual strip page plus Writer download so they keep running even after a Cursor Origin session ends.

---

## Open it

| What | Link that stays on | What you’ll see |
| --- | --- | --- |
| **The day dashboard** | [daymeter.vercel.app](https://daymeter.vercel.app) | Total screen time, device split, the evening strip, tools. Hover a mark for the floating card. |
| **Phone Writer** | [daymeter-writer.vercel.app](https://daymeter-writer.vercel.app) | A one-button page. Open it **on the phone**, tap Download, install the app. |

Those two don’t use numbered Origin session names, so they keep running when a session ends.

The phone app that’s already installed still talks to the Origin strip at [daymeter-dashboard11.vercel.app](https://daymeter-dashboard11.vercel.app) (Writer send goes through take 9, then shows up there). Leave those up. Same download file also lives at [daymeter-writer-apk4.vercel.app](https://daymeter-writer-apk4.vercel.app).

Phone install is sideload (not Play Store). The only permission it asks for is **Usage access** — Android’s “which apps did I use” setting. After install, open Writer and tap **Write + upload now**. Version **1.2** sends timed sessions (not only a day total) so Phone can sit on the hour grid.

---

## What you’re looking at

A centered dashboard of the day, not a timesheet or a score.

**The date sits in the middle** — written in plain language, like 11 September 2026.

**Screen time is the number at the top.** It is the sum across Mac, MSI, and Phone. Computer time is estimated from how long an app stayed in front between looks. Phone time is what Writer reported. Hover any mark, bar, or device card for the nitty-gritty.

**Three device cards** sit under that number: Mac (gold), MSI (teal), Phone (muted purple). Tap one to slice the rest of the page.

**The strip** is still the evening picture: hard rectangles on the lanes that actually have clocks. A gap is a missing look, not idle time. Phone gets a lane only when sessions arrive with start times.

**Readings** are first-order facts from the looks. **Second order** sits under that: insights, wastage, recovery, improvement — inferred, not extra events.

**Tools** break down the apps. Phone has its own section because you jump more there. A Writer summary is hours + mix + switches. Timestamped sessions split time per app and can sit on the hour grid.

A **live / origin / seed** line under the name says how stale the picture is. The page pulls `/api/live` about once a minute, and if that route is down it still reads Writer from Origin dashboard11.

---

## How a day gets into the picture

GitHub `data.json` is a freeze. It goes stale the moment a collector POSTs somewhere else.

Near-real-time (a few minutes lag is fine):

1. **Mac and MSI** POST the frontmost app every 1–2 minutes to `https://daymeter.vercel.app/api/ingest` — scripts in [`collectors/`](collectors/README.md). Each poll closes the *previous* look with `seconds`/`end` (idle ≥ 3 minutes is not counted). When a browser is in front, Mac also sends the tab title, URL, and bundle id.
2. **Phone Writer 1.2** posts timed UsageEvents sessions (`ts`, `end`, `seconds`, `app`, `className`) plus the day-summary to live ingest and Origin. Until that APK is installed, the page still **pulls Origin totals**, and you can pipe `adb shell dumpsys usagestats` through [`collectors/phone-dumpsys.py`](collectors/phone-dumpsys.py).
3. The dashboard merges seed < Origin < live store. Production ingest writes Vercel Runtime Cache (Blob when `BLOB_READ_WRITE_TOKEN` exists). Local Vite writes `dashboard/.data/live.json`. It does not invent marks for the blanks. If `/api/live` is missing, the browser still pulls Origin directly (dashboard11 already allows CORS).

The **behavior agent** (custom instructions in [`agent/INSTRUCTIONS.md`](agent/INSTRUCTIONS.md), Cursor agent in `.cursor/agents/daymeter-behavior.md`) re-reads the live log, checks collector freshness, and writes the second-order section. It never invents samples.

---

## Design rules that stuck

These came out of the Origin cuts (named Fae, Indigo, craft lock). They’re the product, not decoration:

- **Don’t costume the day.** No fake second day so the arrows look alive. Prev/next wait for another *real* day.
- **Don’t invent continuity.** Marks are hard rectangles. Blanks stay blank. Stairs don’t pack empty hours into a fake slope.
- **Color lives on the lane names**, not a rainbow legend.
- **Phone stays offstage** until a real report exists.
- **Mobile is a smaller instrument**, not a squeezed desktop.
- **You can slice** (Mac only, MSI only, one app, both awake) without turning the strip into a dashboard of charts.
- **Night note waits.** It does not auto-write.

Things that got tried and put back: a “LED mountain” denseness graphic, a rainbow legend, filling the phone lane before anything was reported.

---

## Where things stand

*As of late 11 Sep / early 12 Sep 2026, India time.*

The strip has **one real computer day** (11 Sep, evening): a handful of looks, mostly Grok Bot on Mac and Chrome on MSI. That is a thin day on purpose — the stairs stay off.

**Writer sent its first phone line overnight.** About a quarter-hour of use, with launcher, WhatsApp, Instagram, Swiggy, and phone manager in the mix, and a lot of app switches. Because it arrived after midnight, it sits on **12 Sep**, not on the 11 Sep computer day. The two days are not merged.

The **night note is still empty**.

The latest Writer build exists because the previous one could crash if you opened it cold. This one waits until you tap **Run once**, then it is allowed to send.

---

## What this repo is (and isn’t)

This is the **product home**: the idea, the rules, the live links, and the files that make the strip and the Writer download page.

- **`dashboard/`** — the day strip you open in a browser, plus `/api/ingest`, `/api/live`, `/api/agent`.
- **`collectors/`** — Mac, MSI, and phone session POST helpers.
- **`agent/`** — custom instructions for the behavior agent.
- **`writer/`** — the phone download door, plus the Writer app file.

Those two folders are what stay published. They do not turn off when an Origin session ends.

If you connect this GitHub repo to the existing `daymeter` Vercel project, leave the root at the repo (this `vercel.json` builds `dashboard/` and serves `/api/*`). Or set the Vercel root to `dashboard/`. Until GitHub is linked, production file-deploys load `dashboard/ship/api/*.js` (rebuild with `npm run bundle:api --prefix dashboard`) from this repo so ingest does not depend on a one-shot seed. Collector POSTs write Runtime Cache on Vercel; add a Blob store if you want the live log to survive cache eviction. Until `/api/live` exists on the site, the page still pulls Writer from Origin dashboard11.

The numbered Origin takes (`dashboard` … `dashboard11`, `writer-apk` … `writer-apk4`) are still up too. Writer on the phone currently sends its day-summary to the Origin strip (take 9), which is why that URL needs to stay live as well.

A fuller session-by-session walk, still in plain language: [context/origin-sessions.md](context/origin-sessions.md).
