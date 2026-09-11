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

Phone install is sideload (not Play Store). The only permission it asks for is **Usage access** — Android’s “which apps did I use” setting. After install, open Writer and tap **Run once**. That first tap is what lets it send a day-summary to the strip.

---

## What you’re looking at

A centered dashboard of the day, not a timesheet or a score.

**The date sits in the middle** — written in plain language, like 11 September 2026.

**Screen time is the number at the top.** It is the sum across Mac, MSI, and Phone. Computer time is estimated from how long an app stayed in front between looks. Phone time is what Writer reported. Hover any mark, bar, or device card for the nitty-gritty.

**Three device cards** sit under that number: Mac (gold), MSI (teal), Phone (muted purple). Tap one to slice the rest of the page.

**The strip** is still the evening picture: hard rectangles on two lanes. A gap is a missing look, not idle time.

**Tools** break down the apps. Phone has its own section because you jump more there — hours, jump rate against the computers, and the apps in the mix (Writer does not yet split phone time per app).

---

## How a day gets into the picture

1. **Mac and MSI** quietly note the frontmost app every so often. Those looks become the gold and teal marks.
2. **Phone** is not sampled the same way. Writer sends a *reported* summary (hours, top apps, how often you switched).
3. Both land on the same day strip. Phone is never mixed into the computer marks so you can still tell “we looked” from “the phone told us.”

Browser tabs and exact URLs are **not collected yet** on either computer. That’s an honest hole, called out on the machine views.

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

- **`dashboard/`** — the day strip you open in a browser (the same picture as the latest Origin take).
- **`writer/`** — the phone download door, plus the Writer app file.

Those two folders are what stay published. They do not turn off when an Origin session ends.

The numbered Origin takes (`dashboard` … `dashboard11`, `writer-apk` … `writer-apk4`) are still up too. Writer on the phone currently sends its day-summary to the Origin strip (take 9), which is why that URL needs to stay live as well.

A fuller session-by-session walk, still in plain language: [context/origin-sessions.md](context/origin-sessions.md).
