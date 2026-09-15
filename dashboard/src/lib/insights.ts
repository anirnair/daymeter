import { CLASS_LABEL, classifyApp } from "./classify";
import {
  dayKey,
  DEVICE_LABEL,
  prettyApp,
  prettyClock,
  prettyDate,
  prettyDuration,
  prettyHourChip,
  prettyTime,
} from "./format";
import {
  coincidences,
  deviceHops,
  jumpsPerHour,
  occupiedHours,
  phoneJumpsPerHour,
  phoneMinutes,
  switches,
} from "./metrics";
import { lagSeconds, prettyLag } from "./freshness";
import type { Insight, PhoneReport, Sample, Slice } from "./types";
import { applyPhoneSlice, applySampleSlice, sliceActive } from "./filters";

function firstLast(samples: Sample[]): { first: Sample; last: Sample } | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a.ms - b.ms);
  return { first: sorted[0], last: sorted[sorted.length - 1] };
}

function daySet(samples: Sample[]): string[] {
  return [...new Set(samples.map((s) => dayKey(s.ts)).filter((d): d is string => Boolean(d)))].sort();
}

export function generateInsights(
  daySamples: Sample[],
  dayPhone: PhoneReport | null,
  slice: Slice,
  daysInView: string[],
  freshness?: { now?: number; lastEvent?: string | null },
): Insight[] {
  const samples = applySampleSlice(daySamples, slice);
  const phone = applyPhoneSlice(dayPhone, slice);
  const out: Insight[] = [];
  const sliced = sliceActive(slice);
  const now = freshness?.now ?? Date.now();

  if (sliced && !samples.length && !phone) {
    out.push({
      id: "empty-slice",
      kicker: "slice",
      title: "Nothing matches this cut.",
      detail: "Clear a filter, or pick another hour / app / device. Marks that went dim still happened — they just sit outside this slice.",
    });
    return out;
  }

  if (!sliced && freshness?.lastEvent) {
    const lag = lagSeconds(freshness.lastEvent, now);
    if (lag != null && lag >= 36 * 3600) {
      out.push({
        id: "stale-log",
        kicker: "freshness",
        title: `This picture is ${prettyLag(freshness.lastEvent, now)} old.`,
        detail:
          "The hero number is estimated from the last looks that exist, not a live meter. Computers only move when a collector polls. Phone is a Writer day-summary. Blanks after the last look are missing, not zero use.",
      });
    }
  }

  if (!sliced && daysInView.length > 1) {
    const computerDays = daySet(daySamples);
    const phoneDays = phone ? [phone.day] : [];
    if (computerDays.length && phoneDays.length && computerDays[0] !== phoneDays[0]) {
      out.push({
        id: "calendar-split",
        kicker: "across days",
        title: `Computers are ${prettyDate(computerDays[0])}. Phone landed on ${prettyDate(phoneDays[0])}.`,
        detail:
          "Writer reported after midnight, so the phone line is the next calendar day — not the same evening as the Mac and MSI looks. Do not read this range as one waking day.",
        slice: { device: "phone" },
      });
    }
  }

  const same = coincidences(samples);
  for (const hit of same) {
    if (hit.mac.app !== hit.msi.app) {
      out.push({
        id: `split-${hit.ts}`,
        kicker: "both awake",
        title: `At ${prettyTime(hit.ts)} both machines were in front — ${prettyApp(hit.mac.app)} on Mac, ${prettyApp(hit.msi.app)} on MSI.`,
        detail: `Same second (${prettyClock(hit.ts)}). That is a split-attention beat, not a shared app. Tap to keep only the half-hour where both were awake.`,
        slice: { overlap: true, hour: Math.floor(hit.mac.h) },
      });
    } else {
      out.push({
        id: `sameapp-${hit.ts}`,
        kicker: "both awake",
        title: `At ${prettyTime(hit.ts)} both machines were on ${prettyApp(hit.mac.app)}.`,
        detail: `Same second (${prettyClock(hit.ts)}). The app is shared; the looks are still two devices.`,
        slice: { overlap: true, app: hit.mac.app },
      });
    }
  }

  if (phone) {
    const phoneMin = phoneMinutes(phone);
    const phoneRate = Math.round(phoneJumpsPerHour(phone));
    const msiRate = Math.round(jumpsPerHour(daySamples.filter((s) => s.key === "msi")));
    const classes = phone.top.map((a) => CLASS_LABEL[classifyApp(a)]);
    const mix = [...new Set(classes)].join(", ");
    if (phone.switches != null && phone.hours) {
      const every = Math.max(1, Math.round((phone.hours * 3600) / phone.switches));
      const vs =
        msiRate > 0
          ? ` MSI is about ${msiRate}/hr from sampled app changes.`
          : " Computers barely switch in the sampled evening.";
      out.push({
        id: "phone-churn",
        kicker: "phone",
        title: `${prettyDuration(phoneMin)} on phone, ${phone.switches} jumps — about every ${every}s (${phoneRate}/hr).`,
        detail:
          `Writer reports a day-summary, not a clock for each app.${vs} ${mix ? `In the mix: ${mix}.` : ""} Phone time is not placed on the hour grid because we do not have hourly phone samples.`,
        slice: { device: "phone" },
      });
    }
  }

  if (!samples.length && phone && slice.device === "phone") {
    out.push({
      id: "phone-only",
      kicker: "phone",
      title: "This cut is phone-only. No Mac or MSI looks sit here.",
      detail: "Phone is reported, not sampled. There is no minute-by-minute lane to draw.",
    });
  }

  const mac = samples.filter((s) => s.key === "mac").sort((a, b) => a.ms - b.ms);
  const msi = samples.filter((s) => s.key === "msi").sort((a, b) => a.ms - b.ms);
  if (mac.length && msi.length) {
    const macLast = mac[mac.length - 1];
    const msiLast = msi[msi.length - 1];
    if (msiLast.ms - macLast.ms > 10 * 60 * 1000) {
      out.push({
        id: "msi-carries",
        kicker: "handoff",
        title: `Mac goes quiet after ${prettyTime(macLast.ts)}. MSI keeps the evening on ${prettyApp(msiLast.app)}.`,
        detail: `Last Mac look: ${prettyApp(macLast.app)} at ${prettyClock(macLast.ts)}. MSI is still marked through ${prettyClock(msiLast.ts)}. Missing Mac marks after that are missing polls, not proof the lid closed.`,
        slice: { device: "msi", hour: Math.floor(msiLast.h) },
      });
    } else if (macLast.ms - msiLast.ms > 10 * 60 * 1000) {
      out.push({
        id: "mac-carries",
        kicker: "handoff",
        title: `MSI goes quiet after ${prettyTime(msiLast.ts)}. Mac keeps going on ${prettyApp(macLast.app)}.`,
        detail: `Last MSI look: ${prettyApp(msiLast.app)} at ${prettyClock(msiLast.ts)}. Mac is still marked through ${prettyClock(macLast.ts)}.`,
        slice: { device: "mac" },
      });
    }
  }

  const byApp = new Map<string, Set<typeof samples[number]["key"]>>();
  for (const s of samples) {
    const set = byApp.get(s.app) ?? new Set();
    set.add(s.key);
    byApp.set(s.app, set);
  }
  const shared = [...byApp.entries()].filter(([, keys]) => keys.has("mac") && keys.has("msi"));
  const macOnly = [...byApp.entries()].filter(([, keys]) => keys.has("mac") && !keys.has("msi"));
  const msiOnly = [...byApp.entries()].filter(([, keys]) => keys.has("msi") && !keys.has("mac"));
  if (shared.length) {
    out.push({
      id: "shared-apps",
      kicker: "across devices",
      title:
        shared.length === 1
          ? `${prettyApp(shared[0][0])} is the app that showed up on both computers.`
          : `${shared.map(([a]) => prettyApp(a)).join(", ")} showed up on both computers.`,
      detail: [
        macOnly.length ? `Mac-only: ${macOnly.map(([a]) => prettyApp(a)).join(", ")}.` : "",
        msiOnly.length ? `MSI-only: ${msiOnly.map(([a]) => prettyApp(a)).join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" ") || "No single-machine-only apps in this slice.",
      slice: { app: shared[0][0] },
    });
  }

  const browsers = samples.filter((s) => s.cls === "browser");
  if (browsers.length) {
    const devices = [...new Set(browsers.map((s) => DEVICE_LABEL[s.key]))];
    const apps = [...new Set(browsers.map((s) => prettyApp(s.app)))];
    const hours = occupiedHours(browsers).map(prettyHourChip);
    const missing = (["mac", "msi"] as const).filter((k) => samples.some((s) => s.key === k) && !browsers.some((s) => s.key === k));
    out.push({
      id: "browsers",
      kicker: "browser",
      title: `${apps.join(", ")} on ${devices.join(" and ")} · ${hours.join(", ")}.`,
      detail:
        (missing.length ? `No browser looks on ${missing.map((k) => DEVICE_LABEL[k]).join(" or ")}. ` : "") +
        "Tabs and URLs are not collected yet — the browser is a box, not a page.",
      slice: { cls: "browser" },
    });
  } else if (samples.length && slice.cls !== "browser") {
    out.push({
      id: "no-browser",
      kicker: "browser",
      title: "No browser in this slice.",
      detail: "If a browser was in front, it was not the sampled app — or this cut left it out.",
    });
  }

  const windowed = firstLast(samples);
  if (windowed && !sliced) {
    const startBand = windowed.first.h;
    if (startBand >= 18) {
      out.push({
        id: "evening-only",
        kicker: "when",
        title: `Computer looks start at ${prettyTime(windowed.first.ts)} and end at ${prettyTime(windowed.last.ts)}.`,
        detail: `Nothing before evening in the log. ${samples.length} look${samples.length === 1 ? "" : "s"} across that window. Gaps are missing polls, not idle time.`,
        slice: { band: "evening" },
      });
    } else if (windowed.last.h < 12) {
      out.push({
        id: "morning-only",
        kicker: "when",
        title: `Looks sit in the morning, ${prettyTime(windowed.first.ts)} – ${prettyTime(windowed.last.ts)}.`,
        detail: `${samples.length} looks. Afternoon and evening are blank in this log.`,
        slice: { band: "morning" },
      });
    }
  }

  if (slice.hour != null && samples.length) {
    const apps = samples.map((s) => `${prettyApp(s.app)} on ${DEVICE_LABEL[s.key]} at ${prettyClock(s.ts)}`);
    out.push({
      id: `hour-${slice.hour}`,
      kicker: prettyHourChip(slice.hour),
      title: `In this hour: ${apps.length} look${apps.length === 1 ? "" : "s"}.`,
      detail: apps.join(". ") + ".",
    });
  }

  if (slice.app && samples.length) {
    const times = samples.map((s) => `${prettyClock(s.ts)} ${DEVICE_LABEL[s.key]}`);
    out.push({
      id: `app-${slice.app}`,
      kicker: CLASS_LABEL[classifyApp(slice.app)],
      title: `${prettyApp(slice.app)} at ${times.join(", ")}.`,
      detail: `${samples.length} look${samples.length === 1 ? "" : "s"} · estimated ${prettyDuration(samples.reduce((n, s) => n + s.minutes, 0))} in front. Stretch is the gap to the next look on that machine, capped at 20 min.`,
    });
  }

  const hops = deviceHops(samples);
  if (hops.length && samples.length >= 3 && sliced) {
    const last = hops[hops.length - 1];
    out.push({
      id: "hops",
      kicker: "device hops",
      title: `${hops.length} hop${hops.length === 1 ? "" : "s"} between Mac and MSI.`,
      detail: `Latest: ${DEVICE_LABEL[last.from]} → ${DEVICE_LABEL[last.to]} at ${prettyTime(last.ts)}. A hop is two consecutive looks on different machines, not a physical move.`,
    });
  }

  if (!sliced && samples.length && samples.length < 8) {
    out.push({
      id: "thin-log",
      kicker: "coverage",
      title: `Thin log: ${samples.length} computer looks. Decisions from this should stay modest.`,
      detail: `${switches(samples.filter((s) => s.key === "mac")) + switches(samples.filter((s) => s.key === "msi"))} app-to-app changes on the computers. More looks would make the hour grid and handoff reading sturdier.`,
    });
  }

  const seen = new Set<string>();
  return out.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, 8);
}
