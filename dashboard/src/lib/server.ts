import type { IncomingMessage, ServerResponse } from "node:http";
import { generateBehavior } from "./behavior";
import { applyIngest, mergeMeta, parseIngestBody } from "./ingest";
import { hydrateMeta } from "./load";
import { readOrigin } from "./origin";
import { liveBackend, liveWritable, readLive, readSeed, writeLive } from "./store";
import type { DaymeterData, PhoneReport } from "./types";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-daymeter-token, Authorization",
  "Cache-Control": "no-store",
} as const;

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra },
  });
}

export function ingestHello(): Response {
  return json({
    ok: true,
    post: "JSON samples, phone sessions, Writer summary, dumpsys usagestats, or TSV",
    header: "x-daymeter-token or ?k=",
    writable: liveWritable(),
    backend: liveBackend(),
  });
}

export function ingestAuthorized(url: string, headers: Headers): boolean {
  const needed = process.env.DAYMETER_INGEST_TOKEN;
  if (!needed) {
    if (process.env.VERCEL_ENV === "production") {
      console.error("DAYMETER_INGEST_TOKEN is not set; /api/ingest is open");
    }
    return true;
  }
  const header =
    headers.get("x-daymeter-token") ||
    headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const query = new URL(url, "http://localhost").searchParams.get("k") || "";
  return header === needed || query === needed;
}

function nowIso(): string {
  const shift = 5.5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + shift);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+0530`;
}

export function latestPhone(phones: Record<string, PhoneReport>): PhoneReport | null {
  return Object.values(phones)
    .sort((a, b) => (a.day || "").localeCompare(b.day || ""))
    .at(-1) ?? null;
}

export async function buildLiveData(): Promise<DaymeterData> {
  const seed = await readSeed();
  const origin = await readOrigin();
  const live = await readLive();
  const meta = mergeMeta(mergeMeta(seed, origin), live);
  const hasLive = Boolean(live.lastIngest || live.samples.length);
  const hasOrigin = Boolean(
    origin && (origin.lastUpdated || origin.samples.length || Object.keys(origin.phones).length),
  );
  const data = hydrateMeta(meta, {
    freshness: {
      source: hasLive ? "live" : hasOrigin ? "origin" : "seed",
      lastIngest: live.lastIngest,
      lastUpdated: meta.lastUpdated ?? live.lastUpdated ?? origin?.lastUpdated ?? null,
      devices: {
        mac: live.devices.mac ?? origin?.devices.mac ?? null,
        msi: live.devices.msi ?? origin?.devices.msi ?? null,
        phone: live.devices.phone ?? origin?.devices.phone ?? null,
      },
      writable: liveWritable(),
    },
    notes: [],
  });
  const computed = generateBehavior(data.samples, latestPhone(data.phones), {
    device: "all",
    app: null,
    cls: "all",
    intent: "all",
    hour: null,
    band: "all",
    overlap: false,
  }, data.days);
  const extras = live.notes.filter((row) => row.id.startsWith("agent-"));
  const byId = new Map(computed.map((row) => [row.id, row]));
  for (const row of extras) byId.set(row.id, row);
  data.notes = [...byId.values()];
  return data;
}

export async function handleLiveGet(): Promise<Response> {
  const data = await buildLiveData();
  return json(data);
}

export async function handleIngestPost(url: string, headers: Headers, body: string): Promise<Response> {
  if (!ingestAuthorized(url, headers)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const parsed = parseIngestBody(body, headers.get("content-type") || "");
  if (!parsed.samples.length && !parsed.phones.length) {
    return json(
      {
        ok: false,
        error: "empty",
        hint: "Send JSON samples, phone sessions, a Writer summary, or TSV. See collectors/README.md.",
      },
      400,
    );
  }
  if (!liveWritable()) {
    return json(
      {
        ok: false,
        error: "store-missing",
        hint: "Local Vite writes dashboard/.data/live.json. On Vercel, ingest uses Runtime Cache, or Blob when BLOB_READ_WRITE_TOKEN is set.",
      },
      501,
    );
  }
  const stamp = nowIso();
  const next = applyIngest(await readLive(), parsed, stamp);
  const merged = hydrateMeta(mergeMeta(mergeMeta(await readSeed(), await readOrigin()), next));
  next.notes = generateBehavior(merged.samples, latestPhone(merged.phones), {
    device: "all",
    app: null,
    cls: "all",
    intent: "all",
    hour: null,
    band: "all",
    overlap: false,
  }, merged.days);
  next.notesAt = stamp;
  const written = await writeLive(next);
  if (!written.ok) {
    return json(
      {
        ok: false,
        error: written.reason || "write-failed",
        hint:
          written.reason === "runtime-cache-write-failed" || written.reason === "runtime-cache-missing"
            ? "Runtime Cache write failed. Add a Vercel Blob store so BLOB_READ_WRITE_TOKEN exists."
            : undefined,
      },
      500,
    );
  }
  return json({
    ok: true,
    accepted: { samples: parsed.samples.length, phones: parsed.phones.length },
    stored: { samples: next.samples.length, phones: Object.keys(next.phones).length },
    lastIngest: next.lastIngest,
    backend: liveBackend(),
  });
}

export async function handleAgent(url: string, headers: Headers, body: string, method: string): Promise<Response> {
  if (method === "POST" && !ingestAuthorized(url, headers)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const data = await buildLiveData();
  const computed = generateBehavior(data.samples, latestPhone(data.phones), {
    device: "all",
    app: null,
    cls: "all",
    intent: "all",
    hour: null,
    band: "all",
    overlap: false,
  }, data.days);

  if (method === "GET") {
    return json({
      ok: true,
      notes: data.notes.length ? data.notes : computed,
      freshness: data.freshness,
      instructions: "agent/INSTRUCTIONS.md",
    });
  }

  let extra: typeof computed = [];
  if (body.trim()) {
    try {
      const parsed = JSON.parse(body) as { notes?: typeof computed };
      if (Array.isArray(parsed.notes)) extra = parsed.notes;
    } catch {
      /* ignore malformed enrichment */
    }
  }
  const byId = new Map<string, (typeof computed)[number]>();
  for (const row of computed) byId.set(row.id, row);
  for (const row of extra) {
    const id = row.id.startsWith("agent-") ? row.id : `agent-${row.id}`;
    byId.set(id, { ...row, id });
  }
  const notes = [...byId.values()];
  if (liveWritable()) {
    const live = await readLive();
    live.notes = notes;
    live.notesAt = nowIso();
    await writeLive(live);
  }
  return json({ ok: true, notes, count: notes.length });
}

type NodeRequest = IncomingMessage & { body?: unknown };

function bodyFromNode(req: NodeRequest): string | null {
  if (typeof req.body === "string") return req.body;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  return null;
}

export async function readIncoming(req: NodeRequest): Promise<{ url: string; headers: Headers; body: string; method: string }> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const pre = bodyFromNode(req);
  let body = pre ?? "";
  if (pre == null) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    body = Buffer.concat(chunks).toString("utf8");
  }
  const host = headers.get("host") || "localhost";
  const url = `http://${host}${req.url || "/"}`;
  return { url, headers, body, method: (req.method || "GET").toUpperCase() };
}

export function asNodeHandler(
  route: (incoming: Awaited<ReturnType<typeof readIncoming>>) => Promise<Response>,
) {
  return async function handler(req: NodeRequest, res: ServerResponse): Promise<void> {
    try {
      if ((req.method || "GET").toUpperCase() === "OPTIONS") {
        res.statusCode = 204;
        for (const [key, value] of Object.entries(CORS)) res.setHeader(key, value);
        res.end();
        return;
      }
      const incoming = await readIncoming(req);
      const response = await route(incoming);
      writeNodeResponse(res, response, await response.text());
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "server-error" }));
    }
  };
}

export function writeNodeResponse(res: ServerResponse, response: Response, body: string): void {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(body);
}
