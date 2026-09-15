import { emptyLive, mergePhoneReports, parseIngestBody } from "./ingest";
import { parseIso } from "./format";
import type { LiveStore } from "./types";

const WRITER_PHONE_URLS = [
  "https://daymeter-dashboard9.vercel.app/api/ingest/phone",
  "https://daymeter-dashboard11.vercel.app/api/ingest/phone",
];

const FETCH_MS = 6_000;
const CACHE_MS = 45_000;

let cache: { at: number; tsv: string } | null = null;

export function writerPhoneSecret(): string {
  const env = (typeof process !== "undefined" ? process.env?.DAYMETER_WRITER_SECRET : undefined)?.trim() || "";
  if (env) return env;
  // Same value the installed Writer APK already sends (BuildConfig.DAYMETER_INGEST_SECRET).
  return "6e88gLxiAKQAzk98F3mn2Lz4XAxeuNED_BgzDo0B5DY";
}

export function writerPhoneUrls(): string[] {
  const raw = (typeof process !== "undefined" ? process.env?.DAYMETER_WRITER_PHONE_URLS : undefined)?.trim();
  if (!raw) return WRITER_PHONE_URLS;
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function fetchWriterLog(url: string, secret: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "text/plain, text/tab-separated-values, application/json",
        authorization: `Bearer ${secret}`,
        "x-daymeter-secret": secret,
        "cache-control": "no-cache",
      },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
    if (text.includes("hours=")) return text;
    return "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export function storeFromWriterTsv(tsv: string): LiveStore {
  return storeFromWriterBody(tsv);
}

export function storeFromWriterBody(body: string): LiveStore {
  const trimmed = body.trim();
  const json = trimmed.startsWith("{") || trimmed.startsWith("[");
  const parsed = parseIngestBody(trimmed, json ? "application/json" : "text/tab-separated-values");
  const phones: LiveStore["phones"] = {};
  for (const phone of parsed.phones) {
    phones[phone.day] = mergePhoneReports(phones[phone.day], phone);
  }
  const lastLine = trimmed
    .split(/\n+/)
    .filter((line) => line.includes("hours="))
    .at(-1);
  const lastTs =
    lastLine?.split("\t")[0] ??
    parsed.samples.at(-1)?.ts ??
    parsed.phones.at(-1)?.day ??
    null;
  const store = emptyLive();
  store.samples = parsed.samples;
  store.phones = phones;
  store.devices = lastTs ? { phone: lastTs } : {};
  store.lastUpdated = lastTs;
  store.lastIngest = lastTs;
  return store;
}

export async function readWriterPhone(): Promise<LiveStore | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.tsv ? storeFromWriterTsv(cache.tsv) : null;
  }
  const secret = writerPhoneSecret();
  const parts = await Promise.all(writerPhoneUrls().map((url) => fetchWriterLog(url, secret)));
  const bodies = parts.map((part) => part.trim()).filter(Boolean);
  const tsv = bodies.join("\n");
  cache = { at: Date.now(), tsv };
  if (!bodies.length) return null;
  let merged = emptyLive();
  for (const body of bodies) {
    const next = storeFromWriterBody(body);
    for (const sample of next.samples) merged.samples.push(sample);
    for (const [day, phone] of Object.entries(next.phones)) {
      merged.phones[day] = mergePhoneReports(merged.phones[day], phone);
    }
    const phoneStamp = newerStamp(merged.devices.phone, next.devices.phone);
    if (phoneStamp) merged.devices.phone = phoneStamp;
    merged.lastUpdated = newerStamp(merged.lastUpdated, next.lastUpdated);
    merged.lastIngest = newerStamp(merged.lastIngest, next.lastIngest);
  }
  return merged;
}

export async function readWriterPhoneTsv(): Promise<string> {
  if (!cache || Date.now() - cache.at >= CACHE_MS) await readWriterPhone();
  return cache?.tsv ?? "";
}

export function resetWriterPhoneCache(): void {
  cache = null;
}

export function newerStamp(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  const am = parseIso(a);
  const bm = parseIso(b);
  if (!Number.isFinite(am)) return b;
  if (!Number.isFinite(bm)) return a;
  return bm >= am ? b : a;
}
