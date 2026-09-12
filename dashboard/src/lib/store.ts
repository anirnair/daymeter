import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { emptyLive } from "./ingest";
import type { LiveStore, Meta } from "./types";

const BLOB_PATH = "daymeter/live.json";
const CACHE_KEY = "live.json";
const CACHE_TTL_SEC = 21 * 24 * 60 * 60;
const LOCAL_PATH = path.join(process.cwd(), ".data", "live.json");

export type LiveBackend = "blob" | "runtime-cache" | "local" | "none";

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function liveBackend(): LiveBackend {
  if (blobEnabled()) return "blob";
  if (process.env.VERCEL) return "runtime-cache";
  return "local";
}

export function liveWritable(): boolean {
  return liveBackend() !== "none";
}

type RuntimeCache = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts?: { ttl?: number; tags?: string[]; name?: string }): Promise<void>;
};

let cacheHandle: Promise<RuntimeCache | null> | null = null;

async function runtimeCache(): Promise<RuntimeCache | null> {
  if (!process.env.VERCEL) return null;
  if (!cacheHandle) {
    cacheHandle = import("@vercel/functions")
      .then((mod) => mod.getCache({ namespace: "daymeter" }) as RuntimeCache)
      .catch((err) => {
        console.error("runtime cache unavailable", err);
        return null;
      });
  }
  return cacheHandle;
}

export async function readSeed(): Promise<Meta> {
  const meta: Meta = {};
  const candidates = [
    path.join(process.cwd(), "data.json"),
    path.join(process.cwd(), "public", "data.json"),
    path.join(process.cwd(), "dashboard", "public", "data.json"),
  ];
  for (const file of candidates) {
    try {
      const text = await readFile(file, "utf8");
      Object.assign(meta, JSON.parse(text) as Meta);
      break;
    } catch {
      /* try the next layout */
    }
  }
  return meta;
}

function asStore(value: unknown): LiveStore {
  if (!value || typeof value !== "object") return emptyLive();
  const row = value as Partial<LiveStore>;
  return {
    version: 1,
    samples: Array.isArray(row.samples) ? row.samples : [],
    phones: row.phones && typeof row.phones === "object" ? row.phones : {},
    lastIngest: row.lastIngest ?? null,
    lastUpdated: row.lastUpdated ?? null,
    devices: row.devices && typeof row.devices === "object" ? row.devices : {},
    notes: Array.isArray(row.notes) ? row.notes : [],
    notesAt: row.notesAt ?? null,
  };
}

function storeFromCacheValue(value: unknown): LiveStore {
  if (typeof value === "string") {
    try {
      return asStore(JSON.parse(value));
    } catch {
      return emptyLive();
    }
  }
  return asStore(value);
}

async function readBlob(): Promise<LiveStore> {
  try {
    const result = await get(BLOB_PATH, {
      access: "private",
      useCache: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode === 304 || !result.stream) return emptyLive();
    const text = await new Response(result.stream).text();
    return asStore(JSON.parse(text));
  } catch (err) {
    console.error("live blob read failed", err);
    return emptyLive();
  }
}

async function readRuntime(): Promise<LiveStore> {
  const cache = await runtimeCache();
  if (!cache) return emptyLive();
  try {
    const value = await cache.get(CACHE_KEY);
    if (value == null) return emptyLive();
    return storeFromCacheValue(value);
  } catch (err) {
    console.error("live runtime-cache read failed", err);
    return emptyLive();
  }
}

async function readLocal(): Promise<LiveStore> {
  try {
    return asStore(JSON.parse(await readFile(LOCAL_PATH, "utf8")));
  } catch {
    return emptyLive();
  }
}

export async function readLive(): Promise<LiveStore> {
  if (blobEnabled()) return readBlob();
  if (process.env.VERCEL) return readRuntime();
  return readLocal();
}

export async function writeLive(store: LiveStore): Promise<{ ok: boolean; reason?: string }> {
  const body = JSON.stringify(store);
  if (blobEnabled()) {
    try {
      await put(BLOB_PATH, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return { ok: true };
    } catch (err) {
      console.error("live blob write failed", err);
      return { ok: false, reason: "blob-write-failed" };
    }
  }
  if (process.env.VERCEL) {
    const cache = await runtimeCache();
    if (!cache) return { ok: false, reason: "runtime-cache-missing" };
    try {
      await cache.set(CACHE_KEY, store, {
        ttl: CACHE_TTL_SEC,
        tags: ["daymeter-live"],
        name: "daymeter-live",
      });
      return { ok: true };
    } catch (err) {
      console.error("live runtime-cache write failed", err);
      return { ok: false, reason: "runtime-cache-write-failed" };
    }
  }
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, body);
  return { ok: true };
}
