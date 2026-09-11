import type { DeviceKey, PhoneReport, Sample } from "./types";

const MAX_GAP_MS = 20 * 60 * 1000;
const TAIL_MS = 5 * 60 * 1000;

export function estimateSampleMinutes(samples: Sample[]): Sample[] {
  const byDev = new Map<DeviceKey, Sample[]>();
  for (const s of samples) {
    const list = byDev.get(s.key) ?? [];
    list.push(s);
    byDev.set(s.key, list);
  }
  const out: Sample[] = [];
  for (const list of byDev.values()) {
    const sorted = [...list].sort((a, b) => a.ms - b.ms);
    for (let i = 0; i < sorted.length; i++) {
      let span = TAIL_MS;
      if (i < sorted.length - 1) {
        span = Math.min(MAX_GAP_MS, Math.max(60_000, sorted[i + 1].ms - sorted[i].ms));
      }
      out.push({ ...sorted[i], minutes: span / 60_000 });
    }
  }
  return out.sort((a, b) => a.ms - b.ms);
}

export function deviceMinutes(samples: Sample[], key: DeviceKey): number {
  return samples.filter((s) => s.key === key).reduce((n, s) => n + s.minutes, 0);
}

export function appMinutes(samples: Sample[]): { app: string; minutes: number; devices: DeviceKey[] }[] {
  const map = new Map<string, { minutes: number; devices: Set<DeviceKey> }>();
  for (const s of samples) {
    const cur = map.get(s.app) ?? { minutes: 0, devices: new Set<DeviceKey>() };
    cur.minutes += s.minutes;
    cur.devices.add(s.key);
    map.set(s.app, cur);
  }
  return [...map.entries()]
    .map(([app, v]) => ({ app, minutes: v.minutes, devices: [...v.devices] }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function switches(list: Sample[]): number {
  const sorted = [...list].sort((a, b) => a.ms - b.ms);
  let n = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].app !== sorted[i - 1].app) n++;
  }
  return n;
}

export function spanHours(list: Sample[]): number {
  if (list.length < 2) return 0.5;
  const sorted = [...list].sort((a, b) => a.ms - b.ms);
  return Math.max(0.5, (sorted[sorted.length - 1].ms - sorted[0].ms) / 3_600_000);
}

export function jumpsPerHour(list: Sample[]): number {
  if (!list.length) return 0;
  return switches(list) / spanHours(list);
}

export function phoneJumpsPerHour(phone: PhoneReport | null): number {
  if (!phone || !phone.hours || !phone.switches) return 0;
  return phone.switches / phone.hours;
}

export function phoneMinutes(phone: PhoneReport | null): number {
  if (!phone?.hours) return 0;
  return phone.hours * 60;
}

export function axisWindow(samples: Sample[]): { start: number; end: number } {
  if (!samples.length) return { start: 18, end: 24 };
  const hs = samples.map((s) => s.h);
  let start = Math.floor(Math.min(...hs)) - 1;
  let end = Math.ceil(Math.max(...hs)) + 1;
  start = Math.max(0, start);
  end = Math.max(end, start + 2);
  return { start, end };
}

export function hourTicks(start: number, end: number): number[] {
  const ticks: number[] = [];
  const step = end - start <= 6 ? 1 : 2;
  for (let h = Math.floor(start); h <= end; h += step) ticks.push(h);
  if (ticks[ticks.length - 1] !== Math.ceil(end)) ticks.push(Math.ceil(end));
  return ticks;
}

export function sampleIndexOnDevice(samples: Sample[], sample: Sample): { index: number; total: number } {
  const list = samples.filter((s) => s.key === sample.key && s.app === sample.app);
  const index = list.findIndex((s) => s.id === sample.id);
  return { index: index + 1, total: list.length };
}

export function parsePhoneLine(line: string): PhoneReport | null {
  if (!line || line.startsWith("#")) return null;
  const parts = line.split("\t");
  const ts = parts[0];
  const day = ts?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!day) return null;
  const fields: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) fields[p.slice(0, eq)] = p.slice(eq + 1);
  }
  const hours = Number(fields.hours);
  if (!Number.isFinite(hours)) return null;
  const top = (fields.top || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const switches = fields.switches != null ? Number(fields.switches) : null;
  return {
    day,
    hours,
    top,
    switches: switches != null && Number.isFinite(switches) ? switches : null,
  };
}
