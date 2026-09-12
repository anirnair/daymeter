import { dayKey, deviceKey, parseIso } from "./format";
import type { DeviceKey, LiveStore, Meta, PhoneReport, RawSample } from "./types";

const MAX_SAMPLES = 20_000;
const MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000;

export function emptyLive(): LiveStore {
  return {
    version: 1,
    samples: [],
    phones: {},
    lastIngest: null,
    lastUpdated: null,
    devices: {},
    notes: [],
    notesAt: null,
  };
}

export function sampleIdentity(raw: RawSample): string {
  const key = deviceKey(raw.device);
  return `${raw.ts}|${key}|${(raw.app || "").trim()}`;
}

function looksLikeTs(value: string): boolean {
  return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) || /^\d{10,13}$/.test(value);
}

export function coerceTs(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    return toIstStamp(ms);
  }
  if (typeof raw !== "string") return null;
  const ts = raw.trim();
  if (!ts) return null;
  if (/^\d{10,13}$/.test(ts)) {
    const n = Number(ts);
    const ms = n < 1e12 ? n * 1000 : n;
    return toIstStamp(ms);
  }
  if (!looksLikeTs(ts)) return null;
  if (/[+-]\d{2}:?\d{2}$/.test(ts) || ts.endsWith("Z")) return ts;
  return `${ts}+0530`;
}

function toIstStamp(ms: number): string {
  const shift = 5.5 * 60 * 60 * 1000;
  const d = new Date(ms + shift);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+0530`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,|;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizePhone(
  day: string,
  phone: { hours: number; top?: string[]; switches?: number | null; day?: string; sampled?: boolean },
): PhoneReport | null {
  const hours = Number(phone.hours);
  if (!Number.isFinite(hours)) return null;
  return {
    day: phone.day || day,
    hours,
    top: phone.top ?? [],
    switches: phone.switches ?? null,
    sampled: phone.sampled ?? false,
  };
}

function rawFromUnknown(row: Record<string, unknown>, fallbackDevice?: string): RawSample | null {
  const ts = coerceTs(row.ts ?? row.timestamp ?? row.at ?? row.start ?? row.time);
  if (!ts) return null;
  const device = asString(row.device ?? row.host ?? row.machine ?? fallbackDevice);
  const app = asString(row.app ?? row.name ?? row.package ?? row.bundle ?? row.process);
  if (!device && !app) return null;
  const end = coerceTs(row.end ?? row.until ?? row.finished) ?? undefined;
  let seconds = asNumber(row.seconds ?? row.duration ?? row.dur);
  if ((seconds == null || seconds <= 0) && end) {
    const span = (parseIso(end) - parseIso(ts)) / 1000;
    if (Number.isFinite(span) && span > 0) seconds = span;
  }
  const sample: RawSample = {
    ts,
    device: device || "unknown",
    app,
  };
  const title = asString(row.title ?? row.window ?? row.heading);
  const url = asString(row.url ?? row.href ?? row.uri);
  const bundle = asString(row.bundle ?? row.bundleId ?? row.package);
  if (title) sample.title = title;
  if (url) sample.url = url;
  if (bundle) sample.bundle = bundle;
  if (end) sample.end = end;
  if (seconds != null && seconds > 0) sample.seconds = seconds;
  return sample;
}

function phoneFromUnknown(row: Record<string, unknown>, fallbackDay?: string): PhoneReport | null {
  const hours = asNumber(row.hours ?? row.hour ?? row.screenHours);
  if (hours == null) return null;
  const day =
    asString(row.day ?? row.date) ||
    dayKey(asString(row.ts ?? row.timestamp ?? row.at)) ||
    fallbackDay ||
    "";
  if (!day) return null;
  const top = asStringList(row.top ?? row.apps ?? row.mix ?? row.packages);
  const switches = asNumber(row.switches ?? row.jumps ?? row.appSwitches);
  return normalizePhone(day, {
    hours,
    top,
    switches: switches ?? null,
    day,
    sampled: false,
  });
}

export type ParsedIngest = {
  samples: RawSample[];
  phones: PhoneReport[];
};

function parseObject(body: Record<string, unknown>): ParsedIngest {
  const samples: RawSample[] = [];
  const phones: PhoneReport[] = [];
  const fallbackDevice = asString(body.device ?? body.host ?? body.machine);
  const fallbackDay = asString(body.day ?? body.date) || dayKey(asString(body.ts ?? body.lastUpdated)) || "";

  const sampleLists = [body.samples, body.looks, body.events, body.rows];
  for (const list of sampleLists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const sample = rawFromUnknown(row as Record<string, unknown>, fallbackDevice);
      if (sample) samples.push(sample);
    }
  }

  if (Array.isArray(body.sessions)) {
    const device = fallbackDevice || "phone";
    for (const row of body.sessions) {
      if (!row || typeof row !== "object") continue;
      const sample = rawFromUnknown({ ...(row as Record<string, unknown>), device }, device);
      if (sample) samples.push(sample);
    }
  }

  const single = rawFromUnknown(body, fallbackDevice);
  if (single && (body.app || body.name || body.package || body.process || body.title || body.url)) {
    samples.push(single);
  }

  const phone = phoneFromUnknown(body, fallbackDay);
  if (phone) phones.push(phone);
  if (body.phone && typeof body.phone === "object") {
    const nested = phoneFromUnknown(body.phone as Record<string, unknown>, fallbackDay);
    if (nested) phones.push(nested);
  }
  if (body.phones && typeof body.phones === "object" && !Array.isArray(body.phones)) {
    for (const [day, row] of Object.entries(body.phones as Record<string, unknown>)) {
      if (!row || typeof row !== "object") continue;
      const nested = phoneFromUnknown({ day, ...(row as Record<string, unknown>) }, day);
      if (nested) phones.push(nested);
    }
  }

  return { samples, phones };
}

function parseTsv(text: string): ParsedIngest {
  const samples: RawSample[] = [];
  const phones: PhoneReport[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("\t");
    if (parts.length >= 3 && looksLikeTs(parts[0]) && !parts[1]?.includes("=")) {
      const sample = rawFromUnknown({ ts: parts[0], device: parts[1], app: parts.slice(2).join("\t") });
      if (sample) samples.push(sample);
      continue;
    }
    const fields: Record<string, string> = {};
    if (looksLikeTs(parts[0])) fields.ts = parts[0];
    for (const p of parts) {
      const eq = p.indexOf("=");
      if (eq > 0) fields[p.slice(0, eq)] = p.slice(eq + 1);
    }
    if (fields.hours) {
      const phone = phoneFromUnknown(fields, dayKey(fields.ts || "") || undefined);
      if (phone) phones.push(phone);
    } else if (fields.ts && (fields.device || fields.app)) {
      const sample = rawFromUnknown(fields);
      if (sample) samples.push(sample);
    }
  }
  return { samples, phones };
}

function parseForm(text: string): ParsedIngest {
  const fields: Record<string, unknown> = {};
  for (const chunk of text.split("&")) {
    if (!chunk) continue;
    const eq = chunk.indexOf("=");
    const key = decodeURIComponent((eq >= 0 ? chunk.slice(0, eq) : chunk).replace(/\+/g, " "));
    const value = decodeURIComponent((eq >= 0 ? chunk.slice(eq + 1) : "").replace(/\+/g, " "));
    fields[key] = value;
  }
  return parseObject(fields);
}

export function parseIngestBody(raw: string, contentType = ""): ParsedIngest {
  const type = contentType.toLowerCase();
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { samples: [], phones: [] };

  if (type.includes("application/x-www-form-urlencoded")) return parseForm(text);
  if (type.includes("text/tab-separated") || (!text.startsWith("{") && !text.startsWith("[") && text.includes("\t"))) {
    return parseTsv(text);
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      const samples: RawSample[] = [];
      const phones: PhoneReport[] = [];
      for (const row of parsed) {
        if (!row || typeof row !== "object") continue;
        const rec = row as Record<string, unknown>;
        const sample = rawFromUnknown(rec);
        if (sample) samples.push(sample);
        const phone = phoneFromUnknown(rec);
        if (phone) phones.push(phone);
      }
      return { samples, phones };
    }
    if (parsed && typeof parsed === "object") return parseObject(parsed as Record<string, unknown>);
  } catch {
    if (text.includes("\t")) return parseTsv(text);
  }
  return { samples: [], phones: [] };
}

export function pruneLive(store: LiveStore, now = Date.now()): LiveStore {
  const cutoff = now - MAX_AGE_MS;
  const samples = store.samples.filter((s) => {
    const ms = parseIso(s.ts);
    return Number.isFinite(ms) && ms >= cutoff;
  });
  const trimmed = samples.length > MAX_SAMPLES ? samples.slice(samples.length - MAX_SAMPLES) : samples;
  const days = new Set<string>();
  for (const s of trimmed) {
    const day = dayKey(s.ts);
    if (day) days.add(day);
  }
  const phones: Record<string, PhoneReport> = {};
  for (const [day, phone] of Object.entries(store.phones)) {
    if (days.has(day) || parseIso(`${day}T00:00:00+0530`) >= cutoff) phones[day] = phone;
  }
  return { ...store, samples: trimmed, phones };
}

export function applyIngest(store: LiveStore, parsed: ParsedIngest, nowIso: string): LiveStore {
  const map = new Map<string, RawSample>();
  for (const sample of store.samples) map.set(sampleIdentity(sample), sample);
  const devices: Partial<Record<DeviceKey, string>> = { ...store.devices };
  for (const sample of parsed.samples) {
    map.set(sampleIdentity(sample), sample);
    devices[deviceKey(sample.device)] = sample.ts;
  }
  const phones = { ...store.phones };
  for (const phone of parsed.phones) {
    phones[phone.day] = phone;
    devices.phone = nowIso;
  }
  if (parsed.samples.some((s) => deviceKey(s.device) === "phone")) {
    devices.phone = parsed.samples.filter((s) => deviceKey(s.device) === "phone").at(-1)?.ts || nowIso;
  }
  return pruneLive({
    ...store,
    samples: [...map.values()].sort((a, b) => parseIso(a.ts) - parseIso(b.ts)),
    phones,
    devices,
    lastIngest: nowIso,
    lastUpdated: nowIso,
  });
}

export function phonesFromSamples(samples: RawSample[], existing: Record<string, PhoneReport>): Record<string, PhoneReport> {
  const byDay = new Map<string, RawSample[]>();
  for (const sample of samples) {
    if (deviceKey(sample.device) !== "phone") continue;
    const day = dayKey(sample.ts);
    if (!day) continue;
    const list = byDay.get(day) ?? [];
    list.push(sample);
    byDay.set(day, list);
  }
  const phones = { ...existing };
  for (const [day, list] of byDay) {
    const sorted = [...list].sort((a, b) => parseIso(a.ts) - parseIso(b.ts));
    let seconds = 0;
    let switches = 0;
    const appSeconds = new Map<string, number>();
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      const dur =
        row.seconds && row.seconds > 0
          ? row.seconds
          : row.end
            ? Math.max(1, (parseIso(row.end) - parseIso(row.ts)) / 1000)
            : 60;
      seconds += dur;
      appSeconds.set(row.app, (appSeconds.get(row.app) ?? 0) + dur);
      if (i > 0 && sorted[i].app !== sorted[i - 1].app) switches += 1;
    }
    const top = [...appSeconds.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([app]) => app);
    phones[day] = {
      day,
      hours: seconds / 3600,
      top,
      switches,
      sampled: true,
    };
  }
  return phones;
}

export function mergeMeta(seed: Meta, live: LiveStore | null): Meta {
  const map = new Map<string, RawSample>();
  for (const sample of seed.samples ?? []) map.set(sampleIdentity(sample), sample);
  for (const sample of live?.samples ?? []) map.set(sampleIdentity(sample), sample);
  const phones: Record<string, PhoneReport> = {};
  if (seed.phones) {
    for (const [day, phone] of Object.entries(seed.phones)) {
      const record = phone as PhoneReport;
      const normalized = normalizePhone(record.day || day, record);
      if (normalized) phones[normalized.day] = normalized;
    }
  } else if (seed.phone) {
    const day = seed.phone.day || seed.day || dayKey(seed.lastUpdated || "") || "";
    const normalized = normalizePhone(day, seed.phone);
    if (normalized) phones[normalized.day] = normalized;
  }
  for (const [day, phone] of Object.entries(live?.phones ?? {})) phones[day] = phone;
  const mergedSamples = [...map.values()].sort((a, b) => parseIso(a.ts) - parseIso(b.ts));
  const lastUpdated = [seed.lastUpdated, live?.lastUpdated, live?.lastIngest]
    .filter((s): s is string => Boolean(s))
    .sort()
    .at(-1);
  return {
    samples: mergedSamples,
    phones: phonesFromSamples(mergedSamples, phones),
    lastUpdated,
  };
}
