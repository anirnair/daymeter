import { bandOf, classifyApp, halfHour } from "./classify";
import { classifyIntent } from "./intent";
import { overlapHalfHours } from "./metrics";
import type { PhoneReport, Sample, Slice } from "./types";

export const EMPTY_SLICE: Slice = {
  device: "all",
  app: null,
  cls: "all",
  intent: "all",
  hour: null,
  band: "all",
  overlap: false,
};

export function sliceActive(slice: Slice): boolean {
  return (
    slice.device !== "all" ||
    slice.app != null ||
    slice.cls !== "all" ||
    slice.intent !== "all" ||
    slice.hour != null ||
    slice.band !== "all" ||
    slice.overlap
  );
}

function sampleIntent(s: Sample) {
  return classifyIntent(s.app, s.cls, s.title, s.url);
}

export function applySampleSlice(samples: Sample[], slice: Slice): Sample[] {
  const both = slice.overlap ? overlapHalfHours(samples) : null;
  return samples.filter((s) => {
    if (slice.device !== "all" && s.key !== slice.device) return false;
    if (slice.app && s.app !== slice.app) return false;
    if (slice.cls !== "all" && s.cls !== slice.cls) return false;
    if (slice.intent !== "all" && sampleIntent(s) !== slice.intent) return false;
    if (slice.hour != null && Math.floor(s.h) !== slice.hour) return false;
    if (slice.band !== "all" && bandOf(s.h) !== slice.band) return false;
    if (both && !both.has(halfHour(s.h))) return false;
    return true;
  });
}

export function applyPhoneSlice(phone: PhoneReport | null, slice: Slice): PhoneReport | null {
  if (!phone) return null;
  if (slice.device === "mac" || slice.device === "msi") return null;
  if (slice.hour != null) return null;
  if (slice.band !== "all") return null;
  if (slice.overlap) return null;
  if (slice.app) {
    if (!phone.top.includes(slice.app)) return null;
    return { ...phone, top: phone.top.filter((app) => app === slice.app) };
  }
  if (slice.cls !== "all") {
    const top = phone.top.filter((app) => classifyApp(app) === slice.cls);
    if (!top.length) return null;
    return { ...phone, top };
  }
  if (slice.intent !== "all") {
    const top = phone.top.filter((app) => classifyIntent(app) === slice.intent);
    if (!top.length) return null;
    return { ...phone, top };
  }
  return phone;
}

export function matchSample(s: Sample, slice: Slice, both: Set<number>): boolean {
  if (slice.device !== "all" && s.key !== slice.device) return false;
  if (slice.app && s.app !== slice.app) return false;
  if (slice.cls !== "all" && s.cls !== slice.cls) return false;
  if (slice.intent !== "all" && sampleIntent(s) !== slice.intent) return false;
  if (slice.hour != null && Math.floor(s.h) !== slice.hour) return false;
  if (slice.band !== "all" && bandOf(s.h) !== slice.band) return false;
  if (slice.overlap && !both.has(halfHour(s.h))) return false;
  return true;
}
