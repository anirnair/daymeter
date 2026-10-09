import { classifyApp, halfHour } from "./classify";
import type { AppClass, DeviceKey, PhoneReport, Sample } from "./types";

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

export function overlapHalfHours(samples: Sample[]): Set<number> {
  const buckets = new Map<number, Set<DeviceKey>>();
  for (const s of samples) {
    if (s.key !== "mac" && s.key !== "msi") continue;
    const b = halfHour(s.h);
    const set = buckets.get(b) ?? new Set<DeviceKey>();
    set.add(s.key);
    buckets.set(b, set);
  }
  const both = new Set<number>();
  for (const [b, set] of buckets) {
    if (set.has("mac") && set.has("msi")) both.add(b);
  }
  return both;
}

export function coincidences(samples: Sample[]): { ts: string; mac: Sample; msi: Sample }[] {
  const bySecond = new Map<string, Sample[]>();
  for (const s of samples) {
    const key = s.ts.replace(/\.\d+/, "");
    const list = bySecond.get(key) ?? [];
    list.push(s);
    bySecond.set(key, list);
  }
  const out: { ts: string; mac: Sample; msi: Sample }[] = [];
  for (const [ts, list] of bySecond) {
    const mac = list.find((s) => s.key === "mac");
    const msi = list.find((s) => s.key === "msi");
    if (mac && msi) out.push({ ts, mac, msi });
  }
  return out.sort((a, b) => a.ts.localeCompare(b.ts));
}

export function deviceHops(samples: Sample[]): { ts: string; from: DeviceKey; to: DeviceKey }[] {
  const tagged = samples
    .filter((s) => s.key === "mac" || s.key === "msi")
    .slice()
    .sort((a, b) => a.ms - b.ms);
  const hops: { ts: string; from: DeviceKey; to: DeviceKey }[] = [];
  for (let i = 1; i < tagged.length; i++) {
    if (tagged[i].key === tagged[i - 1].key) continue;
    if (Math.abs(tagged[i].ms - tagged[i - 1].ms) < 2000) continue;
    hops.push({ ts: tagged[i].ts, from: tagged[i - 1].key, to: tagged[i].key });
  }
  return hops;
}

export function hourHistogram(samples: Sample[]): { hour: number; mac: number; msi: number; minutes: number }[] {
  const map = new Map<number, { mac: number; msi: number; minutes: number }>();
  for (const s of samples) {
    const hour = Math.floor(s.h);
    const cur = map.get(hour) ?? { mac: 0, msi: 0, minutes: 0 };
    if (s.key === "mac") cur.mac += 1;
    if (s.key === "msi") cur.msi += 1;
    cur.minutes += s.minutes;
    map.set(hour, cur);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({ hour, ...v }));
}

export function classMinutes(samples: Sample[]): { cls: AppClass; minutes: number; apps: string[] }[] {
  const map = new Map<AppClass, { minutes: number; apps: Set<string> }>();
  for (const s of samples) {
    const cur = map.get(s.cls) ?? { minutes: 0, apps: new Set<string>() };
    cur.minutes += s.minutes;
    cur.apps.add(s.app);
    map.set(s.cls, cur);
  }
  return [...map.entries()]
    .map(([cls, v]) => ({ cls, minutes: v.minutes, apps: [...v.apps] }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function phoneClasses(phone: PhoneReport | null): { cls: AppClass; apps: string[] }[] {
  if (!phone) return [];
  const map = new Map<AppClass, string[]>();
  for (const app of phone.top) {
    const cls = classifyApp(app);
    const list = map.get(cls) ?? [];
    list.push(app);
    map.set(cls, list);
  }
  return [...map.entries()].map(([cls, apps]) => ({ cls, apps }));
}

export function occupiedHours(samples: Sample[]): number[] {
  return [...new Set(samples.map((s) => Math.floor(s.h)))].sort((a, b) => a - b);
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
    ts,
  };
}
