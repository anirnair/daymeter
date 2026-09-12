import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { emptyLive } from "./ingest";
import type { LiveStore, Meta } from "./types";

const BLOB_PATH = "daymeter/live.json";
const LOCAL_PATH = path.join(process.cwd(), ".data", "live.json");

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function liveWritable(): boolean {
  return blobEnabled() || !process.env.VERCEL;
}

export async function readSeed(): Promise<Meta> {
  const meta: Meta = {};
  const candidates = [
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

export async function readLive(): Promise<LiveStore> {
  if (blobEnabled()) {
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
  try {
    return asStore(JSON.parse(await readFile(LOCAL_PATH, "utf8")));
  } catch {
    return emptyLive();
  }
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
    return { ok: false, reason: "blob-missing" };
  }
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, body);
  return { ok: true };
}
