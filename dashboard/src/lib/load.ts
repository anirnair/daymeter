import { classifyApp } from "./classify";
import { deviceKey, dayKey, parseIso, hourFrac } from "./format";
import { freshnessFromData } from "./freshness";
import { estimateSampleMinutes, parsePhoneLine } from "./metrics";
import type { DaymeterData, Freshness, FreshnessSource, PhoneReport, RawSample, Sample } from "./types";

type Meta = {
  samples?: RawSample[];
  lastUpdated?: string;
  day?: string;
  days?: string[];
  phone?: { hours: number; top?: string[]; switches?: number; day?: string; ts?: string | null };
  phones?: Record<string, PhoneReport | { hours: number; top?: string[]; switches?: number; day?: string; ts?: string | null }>;
  sentences?: Record<string, string | null>;
  freshness?: Partial<Freshness> & { source?: FreshnessSource };
};

function asSample(raw: RawSample, i: number): Sample | null {
  const ms = parseIso(raw.ts);
  if (!Number.isFinite(ms)) return null;
  const key = deviceKey(raw.device);
  if (key === "phone") return null;
  const h = hourFrac(raw.ts);
  if (h == null) return null;
  const app = (raw.app || "").trim();
  return {
    ...raw,
    app,
    key,
    ms,
    h,
    id: `${raw.ts}|${key}|${app}|${i}`,
    minutes: 5,
    cls: classifyApp(app),
  };
}

function normalizePhone(
  day: string,
  phone: { hours: number; top?: string[]; switches?: number | null; day?: string; ts?: string | null },
): PhoneReport {
  return {
    day: phone.day || day,
    hours: Number(phone.hours),
    top: phone.top ?? [],
    switches: phone.switches ?? null,
    ts: phone.ts ?? null,
  };
}

function collectDays(samples: Sample[], phones: Record<string, PhoneReport>, extra: string[] = []): string[] {
  const daySet = new Set<string>(extra);
  for (const s of samples) {
    const d = dayKey(s.ts);
    if (d) daySet.add(d);
  }
  for (const day of Object.keys(phones)) daySet.add(day);
  return [...daySet].sort();
}

function hydrate(meta: Meta, extras?: { source?: FreshnessSource; devices?: Freshness["devices"] | null }): DaymeterData {
  let samples: Sample[] = [];
  const phones: Record<string, PhoneReport> = {};
  const lastUpdated = meta.lastUpdated ?? null;

  if (Array.isArray(meta.samples)) {
    samples = meta.samples.map(asSample).filter((s): s is Sample => s != null);
  }
  if (meta.phones) {
    for (const [day, phone] of Object.entries(meta.phones)) {
      const record = phone as {
        hours: number;
        top?: string[];
        switches?: number | null;
        day?: string;
        ts?: string | null;
      };
      phones[record.day || day] = normalizePhone(day, record);
    }
  } else if (meta.phone) {
    const day = meta.phone.day || meta.day || dayKey(meta.lastUpdated || "") || "";
    if (day) phones[day] = normalizePhone(day, meta.phone);
  }

  samples = estimateSampleMinutes(samples);
  const days = collectDays(samples, phones, meta.days ?? []);
  return {
    samples,
    phones,
    days,
    lastUpdated,
    freshness: freshnessFromData({
      samples,
      phones,
      lastUpdated,
      source: extras?.source ?? meta.freshness?.source ?? "seed",
      devices: extras?.devices ?? meta.freshness?.devices ?? null,
    }),
  };
}

async function loadSeed(): Promise<DaymeterData> {
  let meta: Meta = {};

  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (res.ok) meta = (await res.json()) as Meta;
  } catch {
    /* fall through to TSV */
  }

  if (!meta.samples?.length) {
    try {
      const tsv = await fetch("./foreground-samples.tsv", { cache: "no-store" });
      if (tsv.ok) {
        const text = await tsv.text();
        meta.samples = text
          .trim()
          .split(/\n+/)
          .filter(Boolean)
          .map((line) => {
            const [ts, device, app] = line.split("\t");
            return { ts, device, app: (app || "").trim() };
          });
      }
    } catch {
      /* empty log */
    }
  }

  const phones = { ...(meta.phones ?? {}) } as Record<string, PhoneReport>;
  try {
    const pr = await fetch("./phone-reported.tsv", { cache: "no-store" });
    if (pr.ok) {
      const text = await pr.text();
      for (const line of text.trim().split(/\n+/)) {
        const parsed = parsePhoneLine(line);
        if (parsed) phones[parsed.day] = parsed;
      }
    }
  } catch {
    /* optional */
  }
  meta.phones = phones;
  return hydrate(meta, { source: "seed" });
}

type LivePayload = Meta & {
  samples?: Sample[] | RawSample[];
  phones?: Record<string, PhoneReport>;
  freshness?: Freshness;
};

export async function loadDaymeter(): Promise<DaymeterData> {
  try {
    const res = await fetch("/api/live", { cache: "no-store" });
    if (res.ok) {
      const live = (await res.json()) as LivePayload;
      if (live && (Array.isArray(live.samples) || live.phones)) {
        return hydrate(live, {
          source: live.freshness?.source === "live" ? "live" : live.freshness?.source === "origin" ? "origin" : "live",
          devices: live.freshness?.devices ?? null,
        });
      }
    }
  } catch {
    /* snapshot fallback */
  }
  return loadSeed();
}
