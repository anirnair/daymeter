# Origin sessions — how the picture changed

All of this happened in Cursor Origin on **11 Sep 2026**, then landed on Vercel as numbered “takes.” Each take is a full publish, not a tiny tweak. Use **dashboard11** and **writer-apk4** day to day. The older URLs are the trail.

None of this is a changelog for engineers. It’s the product conversation, in order.

---

## The day strip (dashboard)

**Workspace:** Cursor Origin `tmp-b200c959dd02049f` (Anirudh Nair)

| Take | Link | What this take was for |
| --- | --- | --- |
| 1 | [daymeter-dashboard.vercel.app](https://daymeter-dashboard.vercel.app) | First public strip. Tight type, no legend — color sits on the lane names. Phone is a number on the label (“reported Nh”), not a dashed bar pretending we sampled it. |
| 2 | [daymeter-dashboard2.vercel.app](https://daymeter-dashboard2.vercel.app) | Hard rectangular marks. Density stairs only when there are enough samples, and empty hours stay empty so the stairs don’t fake a continuous day. Phone hidden until reported. Explicitly *not* a light-up mountain or rainbow key. |
| 3 | [daymeter-dashboard3.vercel.app](https://daymeter-dashboard3.vercel.app) | A denseness “mountain” snuck back in. **Reverted.** The Fae cut from take 2 is the picture. |
| 4 | [daymeter-dashboard4.vercel.app](https://daymeter-dashboard4.vercel.app) | Locked the “done bar” as the plate — the version of the page that was meant to ship, not keep mutating. |
| 5 | [daymeter-dashboard5.vercel.app](https://daymeter-dashboard5.vercel.app) | Honesty: with only one day in the log, left/right stay off. A quiet line says so. No costume day. |
| 6 | [daymeter-dashboard6.vercel.app](https://daymeter-dashboard6.vercel.app) | Same honesty, tighter copy: *one day in the log · prev/next wait for another real day.* |
| 7–8 | [7](https://daymeter-dashboard7.vercel.app) · [8](https://daymeter-dashboard8.vercel.app) | Same six evening samples, clock rolled forward so the “updated” line is true. No visual change. |
| 9 | [daymeter-dashboard9.vercel.app](https://daymeter-dashboard9.vercel.app) | Phone-sized strip: overview only, slice filters, phone still gated (empty until a real report). Mountain stays out. |
| 10 | [daymeter-dashboard10.vercel.app](https://daymeter-dashboard10.vercel.app) | Craft lock — the HTML plate frozen so later work doesn’t drift the look. |
| **11** | **[daymeter-dashboard11.vercel.app](https://daymeter-dashboard11.vercel.app)** | **Current.** First phone-reported line from Writer actually arrived and showed up on the strip. |

### What the latest strip lets you do

- Flip days only when a second real day exists.
- Overview: Mac + MSI lanes, optional phone lane, hover/tap for detail, tap again to keep a mark selected.
- Slice: all / Mac / MSI / both awake, plus a few apps when you’re on overview.
- Mac / MSI tabs (desktop): how many looks, how often the front app changed, recent marks. Tabs and URLs still called out as *not collected*.
- Phone tab: only if Writer reported. Hours and top apps. Clearly “reported,” not sampled.

---

## Phone Writer

**Workspace:** Cursor Origin `tmp-94542629159a6209` (Anirudh Nair)

Writer is a small Android app. The Vercel pages are not the app itself — they are a **download door** so you can install from the phone without bouncing through Cursor.

| Take | Link | What this take was for |
| --- | --- | --- |
| 1 | [daymeter-writer-apk.vercel.app](https://daymeter-writer-apk.vercel.app) | First download page. Open on the phone, tap Download. |
| 2 | [daymeter-writer-apk2.vercel.app](https://daymeter-writer-apk2.vercel.app) | Rebuild so the phone can actually send to the strip (the earlier build couldn’t talk to it). |
| 3 | [daymeter-writer-apk3.vercel.app](https://daymeter-writer-apk3.vercel.app) | Pointed at dashboard 9, which is when the strip grew a place to receive the phone line. |
| **4** | **[daymeter-writer-apk4.vercel.app](https://daymeter-writer-apk4.vercel.app)** | **Current.** Opening the app was crashing before anything ran. This build does nothing heavy until you tap **Run once**. After that, sending the day and the daily pass are allowed. |

On the page: *Sideload. Usage Access only. Open this page on the phone and tap Download.*

---

## What one evening of samples looked like

Not a demo dataset — the first real dump.

**11 Sep, computers (six looks, all evening):**

- Mac: Grok Bot (twice)
- MSI: Grok Bot, then Chrome (three looks)

That’s why the strip still reads as **sparse**. Stairs stay off. Night note still waiting.

**12 Sep, just after midnight — first Writer report:**

- About **0.28 hours** on phone
- Apps named: launcher, WhatsApp, Instagram, Swiggy, phone manager
- Many switches (the report counted 126)

That line belongs to the **next calendar day**, so it does not paint over the 11 Sep computer evening. That split is a product fact, not a bug to hide: phone and computers can land on different dates if one of them reports after midnight.

---

## Names that showed up in the sessions

You don’t need these to use the product. They’re here so a later session doesn’t sound like a different project.

- **Fae** — the visual cut: hard marks, honest gaps, no mountain, no rainbow, phone off until real.
- **Indigo** — copy and mobile: one-day honesty line; then the smaller phone layout with slices.
- **Craft lock / done-bar plate** — freeze the page that shipped, stop restyling it every hour.
- **Both awake** — a slice for times Mac and MSI both had a look in the same half-hour. Not a collaboration score.

---

## Still open

- A second computer day, so prev/next become real.
- A night note for 11 Sep (and for 12 Sep once that day fills).
- Phone and computer on the same calendar day, once Writer runs during waking hours.
- Browser tabs / URLs on Mac and MSI — named as missing, not built.
- Browser tabs / URLs on Mac and MSI — named as missing, not built.
- Keep the Origin ingest URL (dashboard 9) alive so the phone on your pocket can still send. The GitHub copies of the strip and the download page are so those two pages don’t depend on a temp Origin session.
