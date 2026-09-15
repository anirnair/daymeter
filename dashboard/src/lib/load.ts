import { classifyApp } from "./classify";
import { deviceKey, dayKey, parseIso, hourFrac } from "./format";
import { emptyFreshness } from "./freshness";
import { estimateSampleMinutes, parsePhoneLine } from "./metrics";
import { mergeMeta, mergePhoneReports, normalizePhone } from "./ingest";
import { readOrigin } from "./origin";
import type { DaymeterData, Freshness, Meta, PhoneReport, RawSample, Sample } from "./types";

export function asSample(raw: RawSample, i: number): Sample | null {
  const ms = parseIso(raw.ts);
  if (!Number.isFinite(ms)) return null;
  const key = deviceKey(raw.device);
  const h = hourFrac(raw.ts);
  if (h == null) return null;
  const app = (raw.app || "").trim();
  const explicit = Boolean(raw.seconds && raw.seconds > 0) || Boolean(raw.end);
  const minutes = raw.seconds && raw.seconds > 0 ? raw.seconds / 60 : 5;
  return {
    ...raw,
    app,
    key,
    ms,
    h,
    id: `${raw.ts}|${key}|${app}|${i}`,
    minutes,
    cls: classifyApp(app),
    explicit,
  };
}

export function hydrateMeta(meta: Meta, extras?: Partial<DaymeterData>): DaymeterData {
  let samples: Sample[] = [];
  const phones: Record<string, PhoneReport> = {};
  let lastUpdated: string | null = meta.lastUpdated ?? null;

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
        sampled?: boolean;
      };
      const normalized = normalizePhone(record.day || day, {
        hours: record.hours,
        top: record.top,
        switches: record.switches ?? undefined,
        day: record.day,
        sampled: record.sampled,
      });
      if (normalized) phones[normalized.day] = normalized;
    }
  } else if (meta.phone) {
    const day = meta.phone.day || meta.day || dayKey(meta.lastUpdated || "") || "";
    const normalized = normalizePhone(day, meta.phone);
    if (normalized) phones[normalized.day] = normalized;
  }

  samples = estimateSampleMinutes(samples);

  const daySet = new Set<string>();
  for (const s of samples) {
    const d = dayKey(s.ts);
    if (d) daySet.add(d);
  }
  for (const day of Object.keys(phones)) daySet.add(day);

  return {
    samples,
    phones,
    days: [...daySet].sort(),
    lastUpdated,
    freshness: extras?.freshness ?? emptyFreshness(lastUpdated),
    notes: extras?.notes ?? [],
  };
}

async function readClientSeedMeta(): Promise<Meta> {
  let meta: Meta = {};
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (res.ok) meta = (await res.json()) as Meta;
  } catch {
    /* fall through */
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
        if (parsed) phones[parsed.day] = mergePhoneReports(phones[parsed.day], parsed);
      }
    }
  } catch {
    /* optional */
  }
  meta.phones = phones;
  return meta;
}

function originFreshness(
  origin: Awaited<ReturnType<typeof readOrigin>>,
  lastUpdated: string | null,
): Freshness {
  const hasOrigin = Boolean(
    origin && (origin.lastUpdated || origin.samples.length || Object.keys(origin.phones).length),
  );
  return {
    source: hasOrigin ? "origin" : "seed",
    lastIngest: null,
    lastUpdated: lastUpdated ?? origin?.lastUpdated ?? null,
    devices: {
      mac: origin?.devices.mac ?? null,
      msi: origin?.devices.msi ?? null,
      phone: origin?.devices.phone ?? null,
    },
    writable: false,
  };
}

export async function loadSeed(): Promise<DaymeterData> {
  const meta = await readClientSeedMeta();
  const data = hydrateMeta(meta);
  const daySet = new Set<string>(data.days);
  for (const day of Object.keys(data.phones)) daySet.add(day);
  data.days = [...daySet].sort();
  return data;
}

export async function loadDaymeter(): Promise<DaymeterData> {
  try {
    const res = await fetch("/api/live", { cache: "no-store" });
    if (res.ok) {
      const live = (await res.json()) as DaymeterData;
      if (live && Array.isArray(live.samples)) {
        return {
          ...hydrateMeta(
            {
              samples: live.samples,
              phones: live.phones,
              lastUpdated: live.lastUpdated ?? undefined,
            },
            { freshness: live.freshness, notes: live.notes },
          ),
        };
      }
    }
  } catch {
    /* origin / seed fallback */
  }

  const seed = await readClientSeedMeta();
  const origin = await readOrigin();
  const meta = mergeMeta(seed, origin);
  const data = hydrateMeta(meta, {
    freshness: originFreshness(origin, meta.lastUpdated ?? origin?.lastUpdated ?? seed.lastUpdated ?? null),
  });
  const daySet = new Set<string>(data.days);
  for (const day of Object.keys(data.phones)) daySet.add(day);
  data.days = [...daySet].sort();
  return data;
}
