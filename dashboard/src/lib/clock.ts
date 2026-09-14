import { classifyIntent } from "./intent";
import { deviceMinutes, phoneMinutes } from "./metrics";
import type { DeviceKey, Intent, PhoneReport, Sample } from "./types";

export type DeviceInterval = {
  start: number;
  end: number;
  key: DeviceKey;
};

export type ClockHour = {
  hour: number;
  mac: number;
  msi: number;
  phone: number;
  minutes: number;
};

export type OverlapStats = {
  dual: number;
  triple: number;
  macMsi: number;
  macPhone: number;
  msiPhone: number;
};

export type Landing = {
  app: string;
  landings: number;
  minutes: number;
  devices: DeviceKey[];
  intent: Intent;
};

const DEVICES: DeviceKey[] = ["mac", "msi", "phone"];

export function sampleIntervals(samples: Sample[]): DeviceInterval[] {
  return samples
    .filter((s) => s.minutes > 0)
    .map((s) => ({
      start: s.ms,
      end: s.ms + s.minutes * 60_000,
      key: s.key,
    }))
    .filter((row) => row.end > row.start);
}

function mergeKey(rows: DeviceInterval[]): DeviceInterval[] {
  const sorted = [...rows].sort((a, b) => a.start - b.start);
  const out: DeviceInterval[] = [];
  for (const row of sorted) {
    const last = out[out.length - 1];
    if (last && row.start <= last.end) {
      last.end = Math.max(last.end, row.end);
    } else {
      out.push({ ...row });
    }
  }
  return out;
}

function coverage(samples: Sample[], key: DeviceKey): DeviceInterval[] {
  return mergeKey(sampleIntervals(samples.filter((s) => s.key === key)));
}

function intersect(a: DeviceInterval[], b: DeviceInterval[]): number {
  let i = 0;
  let j = 0;
  let ms = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);
    if (end > start) ms += end - start;
    if (a[i].end < b[j].end) i += 1;
    else j += 1;
  }
  return ms / 60_000;
}

export function overlapStats(samples: Sample[]): OverlapStats {
  const mac = coverage(samples, "mac");
  const msi = coverage(samples, "msi");
  const phone = coverage(samples, "phone");
  const macMsi = intersect(mac, msi);
  const macPhone = intersect(mac, phone);
  const msiPhone = intersect(msi, phone);
  const tripleMin = intersect(
    intervalsAnd(mac, msi).map((row) => ({ ...row, key: "mac" as const })),
    phone,
  );
  const dual = macMsi + macPhone + msiPhone - 2 * tripleMin;
  return {
    dual: Math.max(0, dual),
    triple: tripleMin,
    macMsi,
    macPhone,
    msiPhone,
  };
}

function intervalsAnd(a: DeviceInterval[], b: DeviceInterval[]): DeviceInterval[] {
  const out: DeviceInterval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);
    if (end > start) out.push({ start, end, key: a[i].key });
    if (a[i].end < b[j].end) i += 1;
    else j += 1;
  }
  return out;
}

export function clockHours(samples: Sample[]): ClockHour[] {
  const rows = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    mac: 0,
    msi: 0,
    phone: 0,
    minutes: 0,
  }));
  for (const s of samples) {
    let remaining = s.minutes;
    let cursor = s.h;
    while (remaining > 0.0001) {
      const hour = Math.floor(((cursor % 24) + 24) % 24);
      const into = cursor - Math.floor(cursor);
      const room = Math.max(0.0001, 1 - into);
      const chunk = Math.min(remaining, room * 60);
      if (s.key === "mac") rows[hour].mac += chunk;
      if (s.key === "msi") rows[hour].msi += chunk;
      if (s.key === "phone") rows[hour].phone += chunk;
      rows[hour].minutes += chunk;
      remaining -= chunk;
      cursor += chunk / 60;
    }
  }
  for (const row of rows) {
    row.mac = Math.min(60, row.mac);
    row.msi = Math.min(60, row.msi);
    row.phone = Math.min(60, row.phone);
  }
  return rows;
}

export function intentMinutes(samples: Sample[], phone: PhoneReport | null = null): { intent: Intent; minutes: number }[] {
  const map = new Map<Intent, number>();
  for (const s of samples) {
    const intent = classifyIntent(s.app, s.cls, s.title, s.url);
    map.set(intent, (map.get(intent) ?? 0) + s.minutes);
  }
  const extra = unclockedPhoneMinutes(samples, phone);
  if (extra > 0 && phone?.top.length) {
    const each = extra / phone.top.length;
    for (const app of phone.top) {
      const intent = classifyIntent(app);
      map.set(intent, (map.get(intent) ?? 0) + each);
    }
  }
  return (["make", "consume", "life", "system"] as Intent[])
    .map((intent) => ({ intent, minutes: map.get(intent) ?? 0 }))
    .filter((row) => row.minutes > 0);
}

export function landings(samples: Sample[], phone: PhoneReport | null = null): Landing[] {
  const map = new Map<string, Landing>();
  const last = new Map<DeviceKey, string>();
  const sorted = [...samples].sort((a, b) => a.ms - b.ms);
  for (const s of sorted) {
    const prev = last.get(s.key);
    const isLanding = prev !== s.app;
    last.set(s.key, s.app);
    const cur = map.get(s.app) ?? {
      app: s.app,
      landings: 0,
      minutes: 0,
      devices: [] as DeviceKey[],
      intent: classifyIntent(s.app, s.cls, s.title, s.url),
    };
    if (isLanding) cur.landings += 1;
    cur.minutes += s.minutes;
    if (!cur.devices.includes(s.key)) cur.devices.push(s.key);
    map.set(s.app, cur);
  }
  const extra = unclockedPhoneMinutes(samples, phone);
  if (phone?.top.length) {
    const each = extra > 0 ? extra / phone.top.length : 0;
    for (const app of phone.top) {
      const cur = map.get(app) ?? {
        app,
        landings: 0,
        minutes: 0,
        devices: ["phone"] as DeviceKey[],
        intent: classifyIntent(app),
      };
      cur.minutes += each;
      if (!cur.devices.includes("phone")) cur.devices.push("phone");
      map.set(app, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.landings - a.landings || b.minutes - a.minutes);
}

export function dayShare(minutes: number): number {
  if (!(minutes > 0)) return 0;
  return Math.min(1, minutes / (24 * 60));
}

export function unclockedPhoneMinutes(samples: Sample[], phone: PhoneReport | null): number {
  const sampled = deviceMinutes(samples, "phone");
  const reported = phoneMinutes(phone);
  return Math.max(0, reported - sampled);
}

export { DEVICES };
