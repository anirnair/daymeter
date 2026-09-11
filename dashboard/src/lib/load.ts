import { deviceKey, dayKey, parseIso, hourFrac } from "./format";
import { estimateSampleMinutes, parsePhoneLine } from "./metrics";
import type { DaymeterData, PhoneReport, RawSample, Sample } from "./types";

type Meta = {
  samples?: RawSample[];
  lastUpdated?: string;
  day?: string;
  phone?: { hours: number; top?: string[]; switches?: number; day?: string };
  phones?: Record<string, PhoneReport | { hours: number; top?: string[]; switches?: number; day?: string }>;
  sentences?: Record<string, string | null>;
};

function asSample(raw: RawSample, i: number): Sample | null {
  const ms = parseIso(raw.ts);
  if (!Number.isFinite(ms)) return null;
  const key = deviceKey(raw.device);
  if (key === "phone") return null;
  const h = hourFrac(raw.ts);
  if (h == null) return null;
  return {
    ...raw,
    app: (raw.app || "").trim(),
    key,
    ms,
    h,
    id: `${raw.ts}|${key}|${raw.app}|${i}`,
    minutes: 5,
  };
}

function normalizePhone(
  day: string,
  phone: { hours: number; top?: string[]; switches?: number; day?: string },
): PhoneReport {
  return {
    day: phone.day || day,
    hours: Number(phone.hours),
    top: phone.top ?? [],
    switches: phone.switches ?? null,
  };
}

export async function loadDaymeter(): Promise<DaymeterData> {
  let samples: Sample[] = [];
  const phones: Record<string, PhoneReport> = {};
  let lastUpdated: string | null = null;

  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (res.ok) {
      const meta = (await res.json()) as Meta;
      if (meta.lastUpdated) lastUpdated = meta.lastUpdated;
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
          };
          phones[record.day || day] = normalizePhone(day, {
            hours: record.hours,
            top: record.top,
            switches: record.switches ?? undefined,
            day: record.day,
          });
        }
      } else if (meta.phone) {
        const day = meta.phone.day || meta.day || dayKey(meta.lastUpdated || "") || "";
        if (day) phones[day] = normalizePhone(day, meta.phone);
      }
    }
  } catch {
    /* fall through to TSV */
  }

  if (!samples.length) {
    try {
      const tsv = await fetch("./foreground-samples.tsv", { cache: "no-store" });
      if (tsv.ok) {
        const text = await tsv.text();
        samples = text
          .trim()
          .split(/\n+/)
          .filter(Boolean)
          .map((line, i) => {
            const [ts, device, app] = line.split("\t");
            return asSample({ ts, device, app: (app || "").trim() }, i);
          })
          .filter((s): s is Sample => s != null);
      }
    } catch {
      /* empty log */
    }
  }

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

  samples = estimateSampleMinutes(samples);

  const daySet = new Set<string>();
  for (const s of samples) {
    const d = dayKey(s.ts);
    if (d) daySet.add(d);
  }
  for (const day of Object.keys(phones)) daySet.add(day);

  const days = [...daySet].sort();
  return { samples, phones, days, lastUpdated };
}
