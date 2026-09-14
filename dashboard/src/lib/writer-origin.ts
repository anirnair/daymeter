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
    if (!text.includes("hours=")) return "";
    return text;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export function storeFromWriterTsv(tsv: string): LiveStore {
  const parsed = parseIngestBody(tsv, "text/tab-separated-values");
  const phones: LiveStore["phones"] = {};
  for (const phone of parsed.phones) {
    phones[phone.day] = mergePhoneReports(phones[phone.day], phone);
  }
  const lastLine = tsv
    .trim()
    .split(/\n+/)
    .filter((line) => line.includes("hours="))
    .at(-1);
  const lastTs = lastLine?.split("\t")[0] ?? null;
  const store = emptyLive();
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
  const tsv = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
  cache = { at: Date.now(), tsv };
  if (!tsv) return null;
  return storeFromWriterTsv(tsv);
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
