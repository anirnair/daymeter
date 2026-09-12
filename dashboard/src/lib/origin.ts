import {
  coerceTs,
  emptyLive,
  mergeMeta,
  normalizePhone,
  parseIngestBody,
  phonesFromSamples,
  sampleIdentity,
} from "./ingest";
import { dayKey, deviceKey, parseIso } from "./format";
import { parsePhoneLine } from "./metrics";
import type { LiveStore, Meta, PhoneReport, RawSample } from "./types";

const DEFAULT_ORIGIN_URLS = [
  "https://daymeter-dashboard11.vercel.app",
  "https://daymeter-dashboard9.vercel.app",
];

const FETCH_MS = 4_000;
const CACHE_MS = 20_000;

let originCache: { at: number; store: LiveStore | null } | null = null;

export function originBases(): string[] {
  const raw =
    (typeof process !== "undefined" ? process.env?.DAYMETER_ORIGIN_URLS : undefined)?.trim() || "";
  if (!raw) return DEFAULT_ORIGIN_URLS;
  return raw
    .split(",")
    .map((part) => part.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function pickNewer(a?: string | null, b?: string | null): string | undefined {
  if (!a) return b ?? undefined;
  if (!b) return a;
  const am = parseIso(a);
  const bm = parseIso(b);
  if (!Number.isFinite(am)) return b;
  if (!Number.isFinite(bm)) return a;
  return bm >= am ? b : a;
}

function latestStamp(values: Array<string | null | undefined>): string | null {
  const stamps = values.filter((value): value is string => Boolean(value));
  if (!stamps.length) return null;
  return stamps.sort((a, b) => parseIso(a) - parseIso(b)).at(-1) ?? null;
}

function mergePhone(existing: PhoneReport | undefined, next: PhoneReport): PhoneReport {
  if (!existing) return next;
  const switches =
    existing.switches == null && next.switches == null
      ? null
      : Math.max(existing.switches ?? 0, next.switches ?? 0);
  const seen = new Set(existing.top);
  const top = [...existing.top];
  for (const app of next.top) {
    if (!seen.has(app)) {
      top.push(app);
      seen.add(app);
    }
  }
  return {
    day: next.day || existing.day,
    hours: Math.max(existing.hours, next.hours),
    top,
    switches,
    sampled: existing.sampled || next.sampled,
  };
}

function parseForegroundTsv(text: string): RawSample[] {
  const samples: RawSample[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("\t");
    if (parts.length < 3) continue;
    const ts = coerceTs(parts[0]);
    if (!ts) continue;
    const sample: RawSample = {
      ts,
      device: parts[1] || "unknown",
      app: (parts[2] || "").trim() || "?",
    };
    const title = (parts[3] || "").trim();
    const url = (parts[4] || "").trim();
    if (title) sample.title = title;
    if (url) sample.url = url;
    samples.push(sample);
  }
  return samples;
}

export function storeFromOriginPayload(input: {
  data?: unknown;
  reportedTsv?: string;
  samplesTsv?: string;
}): LiveStore {
  const payload = (input.data && typeof input.data === "object" ? input.data : {}) as Meta;
  const samples: RawSample[] = [];
  if (payload.samples?.length) {
    samples.push(...parseIngestBody(JSON.stringify({ samples: payload.samples })).samples);
  }
  if (input.samplesTsv) samples.push(...parseForegroundTsv(input.samplesTsv));

  const phones: Record<string, PhoneReport> = {};
  if (payload.phone) {
    const day = payload.phone.day || payload.day || dayKey(payload.lastUpdated || "") || "";
    const normalized = normalizePhone(day, payload.phone);
    if (normalized) phones[normalized.day] = normalized;
  }
  if (payload.phones) {
    for (const [day, row] of Object.entries(payload.phones)) {
      const record = row as PhoneReport;
      const normalized = normalizePhone(record.day || day, record);
      if (normalized) phones[normalized.day] = mergePhone(phones[normalized.day], normalized);
    }
  }
  if (input.reportedTsv) {
    for (const line of input.reportedTsv.split(/\r?\n/)) {
      const parsed = parsePhoneLine(line);
      if (!parsed) continue;
      phones[parsed.day] = mergePhone(phones[parsed.day], parsed);
    }
  }

  const map = new Map<string, RawSample>();
  for (const sample of samples) map.set(sampleIdentity(sample), sample);
  const mergedSamples = [...map.values()].sort((a, b) => parseIso(a.ts) - parseIso(b.ts));

  const devices: LiveStore["devices"] = {};
  for (const sample of mergedSamples) {
    devices[deviceKey(sample.device)] = sample.ts;
  }
  if (input.reportedTsv) {
    for (const line of input.reportedTsv.split(/\r?\n/)) {
      const ts = coerceTs(line.split("\t")[0] || "");
      if (ts) devices.phone = pickNewer(devices.phone, ts);
    }
  }

  const store = emptyLive();
  store.samples = mergedSamples;
  store.phones = phonesFromSamples(mergedSamples, phones);
  store.devices = devices;
  store.lastUpdated = latestStamp([
    payload.lastUpdated,
    ...mergedSamples.map((sample) => sample.ts),
    devices.mac,
    devices.msi,
    devices.phone,
  ]);
  return store;
}

export function mergeOriginStores(a: LiveStore, b: LiveStore): LiveStore {
  const meta = mergeMeta(
    {
      samples: a.samples,
      phones: a.phones,
      lastUpdated: a.lastUpdated ?? undefined,
    },
    b,
  );
  return {
    version: 1,
    samples: meta.samples ?? [],
    phones: (meta.phones ?? {}) as Record<string, PhoneReport>,
    lastIngest: null,
    lastUpdated: latestStamp([meta.lastUpdated, a.lastUpdated, b.lastUpdated]),
    devices: {
      mac: pickNewer(a.devices.mac, b.devices.mac),
      msi: pickNewer(a.devices.msi, b.devices.msi),
      phone: pickNewer(a.devices.phone, b.devices.phone),
    },
    notes: [],
    notesAt: null,
  };
}

function originOccupied(store: LiveStore | null): store is LiveStore {
  return Boolean(store && (store.samples.length || Object.keys(store.phones).length));
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "text/plain, application/json" },
    signal,
  });
  if (!response.ok) return "";
  return response.text();
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) return null;
  return response.json();
}

async function readOneOrigin(base: string): Promise<LiveStore | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const [data, reportedTsv, samplesTsv] = await Promise.all([
      fetchJson(`${base}/data.json`, controller.signal).catch(() => null),
      fetchText(`${base}/phone-reported.tsv`, controller.signal).catch(() => ""),
      fetchText(`${base}/foreground-samples.tsv`, controller.signal).catch(() => ""),
    ]);
    const store = storeFromOriginPayload({ data, reportedTsv, samplesTsv });
    return originOccupied(store) ? store : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function readOrigin(): Promise<LiveStore | null> {
  if (originCache && Date.now() - originCache.at < CACHE_MS) return originCache.store;
  const bases = originBases();
  let store: LiveStore | null = null;
  for (const base of bases) {
    const next = await readOneOrigin(base);
    if (!next) continue;
    store = store ? mergeOriginStores(store, next) : next;
  }
  originCache = { at: Date.now(), store };
  return store;
}

export function resetOriginCache(): void {
  originCache = null;
}
