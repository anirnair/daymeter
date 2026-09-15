import { CLASS_LABEL, classifyApp } from "./classify";
import {
  DEVICE_LABEL,
  prettyApp,
  prettyClock,
  prettyDate,
  prettyDuration,
  prettyTime,
} from "./format";
import {
  appMinutes,
  classMinutes,
  coincidences,
  deviceHops,
  deviceMinutes,
  jumpsPerHour,
  occupiedHours,
  phoneJumpsPerHour,
  phoneMinutes,
  spanHours,
  switches,
} from "./metrics";
import type { BehaviorNote, PhoneReport, Sample, Slice } from "./types";
import { applyPhoneSlice, applySampleSlice, sliceActive } from "./filters";

function firstLast(samples: Sample[]): { first: Sample; last: Sample } | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a.ms - b.ms);
  return { first: sorted[0], last: sorted[sorted.length - 1] };
}

function daySet(samples: Sample[]): string[] {
  return [...new Set(samples.map((s) => s.ts.slice(0, 10)))].sort();
}

function note(
  partial: Omit<BehaviorNote, "evidence"> & { evidence?: string[] },
): BehaviorNote {
  return { evidence: [], ...partial };
}

export function generateBehavior(
  daySamples: Sample[],
  dayPhone: PhoneReport | null,
  slice: Slice,
  daysInView: string[],
): BehaviorNote[] {
  const samples = applySampleSlice(daySamples, slice);
  const phone = applyPhoneSlice(dayPhone, slice);
  const out: BehaviorNote[] = [];
  const sliced = sliceActive(slice);
  const computers = samples.filter((s) => s.key === "mac" || s.key === "msi");
  const phoneLooks = samples.filter((s) => s.key === "phone");
  const mac = computers.filter((s) => s.key === "mac").sort((a, b) => a.ms - b.ms);
  const msi = computers.filter((s) => s.key === "msi").sort((a, b) => a.ms - b.ms);
  const phoneMin = phoneLooks.length
    ? deviceMinutes(phoneLooks, "phone")
    : phoneMinutes(phone);
  const macMin = deviceMinutes(computers, "mac");
  const msiMin = deviceMinutes(computers, "msi");
  const same = coincidences(computers);
  const windowed = firstLast(computers);
  const phoneRate = Math.max(
    phoneLooks.length ? jumpsPerHour(phoneLooks) : 0,
    phoneJumpsPerHour(phone),
  );
  const msiRate = jumpsPerHour(msi);
  const macRate = jumpsPerHour(mac);
  const classes = classMinutes(computers);
  const tools = appMinutes(samples);

  if (sliced && !samples.length && !phone) return [];

  if (!sliced && daysInView.length > 1) {
    const computerDays = daySet(computers);
    const phoneDays = phone ? [phone.day] : phoneLooks.map((s) => s.ts.slice(0, 10));
    const uniqPhoneDays = [...new Set(phoneDays)];
    if (computerDays.length && uniqPhoneDays.length && computerDays[0] !== uniqPhoneDays[0]) {
      out.push(
        note({
          id: "split-day-insight",
          kind: "insight",
          kicker: "calendar",
          title: `Computers closed on ${prettyDate(computerDays[0])}. Phone landed on ${prettyDate(uniqPhoneDays[0])}.`,
          detail:
            "That is two calendar days, not one waking day. Second-order readings below treat them as adjacent, not simultaneous.",
          evidence: [
            computers[0] ? `first computer look ${prettyClock(computers[0].ts)}` : "",
            phoneLooks[0]
              ? `first phone session ${prettyClock(phoneLooks[0].ts)}`
              : phone
                ? `phone report ${phone.hours}h · ${phone.switches ?? "?"} jumps`
                : "",
          ].filter(Boolean),
          slice: { device: "phone" },
        }),
      );
    }
  }

  if (windowed) {
    out.push(
      note({
        id: "span-insight",
        kind: "insight",
        kicker: "coverage",
        title: `Computer looks run ${prettyTime(windowed.first.ts)} – ${prettyTime(windowed.last.ts)} (${prettyDuration((windowed.last.ms - windowed.first.ms) / 60000 + 5)} wall).`,
        detail: `${computers.length} looks · Mac ${prettyDuration(macMin)} · MSI ${prettyDuration(msiMin)}. Gaps are missing polls, not idle. Stretch estimates cap at 20 min.`,
        evidence: computers.map(
          (s) => `${prettyClock(s.ts)} ${DEVICE_LABEL[s.key]} ${prettyApp(s.app)}${s.title ? ` · ${s.title}` : ""}${s.url ? ` · ${s.url}` : ""}`,
        ),
      }),
    );
  }

  if (phone || phoneLooks.length) {
    const every =
      phone?.switches && phone.hours
        ? Math.max(1, Math.round((phone.hours * 3600) / phone.switches))
        : phoneLooks.length > 1
          ? Math.max(1, Math.round((spanHours(phoneLooks) * 3600) / Math.max(1, switches(phoneLooks))))
          : null;
    const mix = (phone?.top ?? [...new Set(phoneLooks.map((s) => s.app))]).map(
      (app) => `${prettyApp(app)} (${CLASS_LABEL[classifyApp(app)]})`,
    );
    out.push(
      note({
        id: "phone-grain",
        kind: "insight",
        kicker: "phone",
        title: phoneLooks.length
          ? `${prettyDuration(phoneMin)} on phone across ${phoneLooks.length} timed session${phoneLooks.length === 1 ? "" : "s"}.`
          : `${prettyDuration(phoneMin)} on phone from a Writer day-summary — no per-app clocks yet.`,
        detail: phoneLooks.length
          ? "These sessions can sit on the hour grid. Seconds came from the payload, not a gap guess."
          : "Accuracy stays coarse until Writer (or dumpsys) sends sessions with start, end, app, and seconds.",
        evidence: [
          phone?.switches != null ? `${phone.switches} jumps` : "",
          every != null ? `about every ${every}s` : "",
          phoneRate ? `${Math.round(phoneRate)} jumps/hr` : "",
          mix.length ? `mix: ${mix.join(", ")}` : "",
        ].filter(Boolean),
        slice: { device: "phone" },
      }),
    );
  }

  for (const hit of same) {
    out.push(
      note({
        id: `split-attn-${hit.ts}`,
        kind: "waste",
        kicker: "split attention",
        title:
          hit.mac.app === hit.msi.app
            ? `At ${prettyClock(hit.ts)} both machines sat on ${prettyApp(hit.mac.app)}.`
            : `At ${prettyClock(hit.ts)} Mac was on ${prettyApp(hit.mac.app)} while MSI was on ${prettyApp(hit.msi.app)}.`,
        detail:
          hit.mac.app === hit.msi.app
            ? "Same second, same app, two screens. That is duplicate attention, not extra work."
            : "Same second, two different apps. That is a split-attention beat — context cost without a hop.",
        evidence: [
          `Mac ${prettyApp(hit.mac.app)}${hit.mac.title ? ` · ${hit.mac.title}` : ""}`,
          `MSI ${prettyApp(hit.msi.app)}${hit.msi.title ? ` · ${hit.msi.title}` : ""}`,
        ],
        slice: { overlap: true, hour: Math.floor(hit.mac.h) },
      }),
    );
  }

  if (phoneRate >= 60 && (msiRate > 0 || macRate > 0)) {
    out.push(
      note({
        id: "churn-waste",
        kind: "waste",
        kicker: "fragmentation",
        title: `Phone is jumping ~${Math.round(phoneRate)}/hr against MSI ~${Math.round(msiRate)}/hr and Mac ~${Math.round(macRate)}/hr.`,
        detail:
          "A high switch rate is the clearest waste signal in this log: attention is sliced thinner than the computers ever were. Social/food in the mix makes the slices cheaper to start and harder to end.",
        evidence: [
          phone?.switches != null ? `${phone.switches} phone jumps in ${prettyDuration(phoneMin)}` : "",
          msi.length ? `MSI app changes: ${switches(msi)}` : "",
          mac.length ? `Mac app changes: ${switches(mac)}` : "",
        ].filter(Boolean),
        slice: { device: "phone" },
      }),
    );
  } else if (phoneRate >= 60) {
    out.push(
      note({
        id: "churn-waste",
        kind: "waste",
        kicker: "fragmentation",
        title: `Phone is jumping ~${Math.round(phoneRate)}/hr in a short reported window.`,
        detail: "Even without a computer comparison, that rate is not focused use. Recover by letting one app sit.",
        evidence: [phone?.switches != null ? `${phone.switches} jumps` : `${phoneLooks.length} sessions`].filter(Boolean),
        slice: { device: "phone" },
      }),
    );
  }

  const socialFood = classes.filter((row) => row.cls === "social" || row.cls === "food");
  const phoneSocial = (phone?.top ?? []).filter((app) => {
    const cls = classifyApp(app);
    return cls === "social" || cls === "food";
  });
  if (phoneSocial.length && phoneMin > 0) {
    out.push(
      note({
        id: "cheap-apps",
        kind: "waste",
        kicker: "cheap loops",
        title: `${phoneSocial.map(prettyApp).join(", ")} showed up in the phone mix.`,
        detail:
          "Not a moral score. These apps are cheap to open and expensive to leave, especially next to a 450/hr jump rate. Treat them as the likely loop, not as timed work.",
        evidence: phoneSocial.map((app) => `${prettyApp(app)} · ${CLASS_LABEL[classifyApp(app)]}`),
        slice: { device: "phone", cls: classifyApp(phoneSocial[0]) },
      }),
    );
  }
  if (socialFood.length && computers.length) {
    out.push(
      note({
        id: "social-on-computer",
        kind: "waste",
        kicker: "cheap loops",
        title: `${socialFood.map((row) => row.apps.map(prettyApp).join(", ")).join("; ")} ate computer time in this cut.`,
        detail: "If that was the job, leave it. If it was a detour from Grok/Chrome work, it is recover-able.",
        evidence: socialFood.map((row) => `${CLASS_LABEL[row.cls]} · ${prettyDuration(row.minutes)}`),
      }),
    );
  }

  if (mac.length && msi.length && same.length) {
    out.push(
      note({
        id: "dual-machine-waste",
        kind: "waste",
        kicker: "two machines",
        title: "Both machines were awake in the same half-hour. One of them was probably spare.",
        detail:
          "Running Grok on Mac and Chrome on MSI at once costs a context switch you do not get back. Prefer one lid open unless the second machine is doing something the first cannot.",
        evidence: [
          `Mac looks: ${mac.map((s) => prettyClock(s.ts)).join(", ")}`,
          `MSI looks: ${msi.map((s) => prettyClock(s.ts)).join(", ")}`,
        ],
        slice: { overlap: true },
      }),
    );
  }

  if (mac.length && msi.length) {
    const macLast = mac[mac.length - 1];
    const msiLast = msi[msi.length - 1];
    if (msiLast.ms - macLast.ms > 10 * 60 * 1000) {
      out.push(
        note({
          id: "mac-quiet-recovery",
          kind: "recovery",
          kicker: "handoff",
          title: `Mac goes quiet after ${prettyClock(macLast.ts)}. MSI carries the rest on ${prettyApp(msiLast.app)}.`,
          detail:
            "That is a recovery from dual-machine mode — if the Mac lid actually closed. Missing Mac polls after that are not proof. If it did close, keep doing that: one machine for the late stretch.",
          evidence: [
            `last Mac: ${prettyApp(macLast.app)} at ${prettyClock(macLast.ts)}`,
            `MSI still marked through ${prettyClock(msiLast.ts)}`,
          ],
          slice: { device: "msi", hour: Math.floor(msiLast.h) },
        }),
      );
    }
  }

  if (windowed && windowed.first.h >= 18 && computers.length && computers.length < 12) {
    out.push(
      note({
        id: "short-evening-recovery",
        kind: "recovery",
        kicker: "bounded evening",
        title: "The computer log is an evening window, not an all-day sit.",
        detail:
          "Nothing before evening is in this log. That can be healthy, or it can mean collectors were down. Until daytime polls exist, do not congratulate a blank morning.",
        evidence: [
          `first look ${prettyClock(windowed.first.ts)}`,
          `last look ${prettyClock(windowed.last.ts)}`,
          occupiedHours(computers).length ? `occupied hours: ${occupiedHours(computers).join(", ")}` : "",
        ].filter(Boolean),
        slice: { band: "evening" },
      }),
    );
  }

  if (phone && !phone.sampled && phoneLooks.length === 0) {
    out.push(
      note({
        id: "phone-after-computers",
        kind: "recovery",
        kicker: "sequence",
        title: "Computer looks had already stopped before the phone summary arrived.",
        detail:
          "If the phone burst was after midnight, the evening computer work had a chance to end. If Writer only ran then, this is a reporting lag, not a recovery. Run Writer in the waking day so the sequence is real.",
        evidence: [
          windowed ? `last computer ${prettyClock(windowed.last.ts)}` : "",
          `${prettyDuration(phoneMin)} reported · ${phone.switches ?? "?"} jumps`,
        ].filter(Boolean),
        slice: { device: "phone" },
      }),
    );
  }

  const hops = deviceHops(computers);
  if (hops.length === 0 && mac.length && msi.length && !same.length) {
    out.push(
      note({
        id: "clean-handoff-recovery",
        kind: "recovery",
        kicker: "handoff",
        title: "No hop between Mac and MSI in this cut — they did not ping-pong.",
        detail: "Serial use is cheaper than split use. Keep that pattern if both machines stay in the day.",
        evidence: [`Mac ${mac.length} looks`, `MSI ${msi.length} looks`],
      }),
    );
  }

  const browsers = computers.filter((s) => s.cls === "browser");
  const missingUrls = browsers.filter((s) => !s.url);
  if (browsers.length && missingUrls.length === browsers.length) {
    out.push(
      note({
        id: "url-improve",
        kind: "improve",
        kicker: "grain",
        title: `${[...new Set(browsers.map((s) => prettyApp(s.app)))].join(", ")} is a box, not a page.`,
        detail:
          "Collectors can send the front tab URL and title. Until they do, Chrome time cannot be split into work vs drift. Turn on the Mac/MSI collectors in this repo — they POST every minute with title and URL when the front app is a browser.",
        evidence: browsers.map((s) => `${prettyClock(s.ts)} ${DEVICE_LABEL[s.key]} ${prettyApp(s.app)}`),
        slice: { cls: "browser" },
      }),
    );
  }

  if (phone && !phone.sampled) {
    out.push(
      note({
        id: "phone-sessions-improve",
        kind: "improve",
        kicker: "grain",
        title: "Phone accuracy is stuck at a day-summary until sessions have clocks.",
        detail:
          "Post `{ device: \"phone\", sessions: [{ ts, end, app, seconds }] }` to /api/ingest. Usage access already has this. Writer’s current dump is hours + top apps + switches — useful, not hourly. A few minutes lag is fine; missing start times is not.",
        evidence: [
          `${phone.hours}h reported`,
          phone.top.length ? `top: ${phone.top.map(prettyApp).join(", ")}` : "",
        ].filter(Boolean),
        slice: { device: "phone" },
      }),
    );
  }

  if (computers.length > 0 && computers.length < 10) {
    out.push(
      note({
        id: "poll-improve",
        kind: "improve",
        kicker: "coverage",
        title: `Only ${computers.length} computer looks in this window. Poll every 1–2 minutes.`,
        detail:
          "A 20-minute cap on estimated stretch is hiding whatever happened in the gaps. launchd (Mac) and a scheduled task (MSI) in collectors/ will keep lag under a couple of minutes without pretending the blanks were idle.",
        evidence: computers.map((s) => `${prettyClock(s.ts)} ${DEVICE_LABEL[s.key]}`),
      }),
    );
  }

  if (mac.length && msi.length && same.length) {
    out.push(
      note({
        id: "one-lid-improve",
        kind: "improve",
        kicker: "habit",
        title: "Prefer one machine when Grok and Chrome are the actual work.",
        detail:
          "The 21:51 same-second beat is the tell. Put chat and browser on the same lid, or close the spare. Dual-app across two devices is the waste; the recovery is already visible when Mac goes quiet.",
        evidence: same.map(
          (hit) => `${prettyClock(hit.ts)} Mac ${prettyApp(hit.mac.app)} / MSI ${prettyApp(hit.msi.app)}`,
        ),
        slice: { overlap: true },
      }),
    );
  }

  if (phoneRate >= 60) {
    out.push(
      note({
        id: "phone-sit-improve",
        kind: "improve",
        kicker: "habit",
        title: "Let one phone app sit for a few minutes instead of cycling the launcher.",
        detail:
          "Launcher in the mix plus a jump every few seconds is the loop. Batch WhatsApp. Open Instagram on purpose or not at all. Food apps once. The computers already show a slower rhythm — copy that, don’t copy the phone into the laptops.",
        evidence: (phone?.top ?? []).map((app) => prettyApp(app)),
        slice: { device: "phone" },
      }),
    );
  }

  if (tools.length) {
    out.push(
      note({
        id: "tool-shape-insight",
        kind: "insight",
        kicker: "tools",
        title: `Front-app shape: ${tools
          .slice(0, 4)
          .map((row) => `${prettyApp(row.app)} ${prettyDuration(row.minutes)}`)
          .join(" · ")}.`,
        detail: tools.some((row) => row.devices.includes("mac") && row.devices.includes("msi"))
          ? "At least one app showed up on both computers. Shared is not the same as simultaneous."
          : "No app crossed both computers in this cut.",
        evidence: tools.map(
          (row) => `${prettyApp(row.app)} · ${prettyDuration(row.minutes)} · ${row.devices.map((d) => DEVICE_LABEL[d]).join(", ")}`,
        ),
      }),
    );
  }

  const seen = new Set<string>();
  return out.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function notesByKind(notes: BehaviorNote[]): Record<BehaviorNote["kind"], BehaviorNote[]> {
  return {
    insight: notes.filter((n) => n.kind === "insight"),
    waste: notes.filter((n) => n.kind === "waste"),
    recovery: notes.filter((n) => n.kind === "recovery"),
    improve: notes.filter((n) => n.kind === "improve"),
  };
}
