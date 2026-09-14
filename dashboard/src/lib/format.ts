import type { DeviceKey } from "./types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const APP_NAMES: Record<string, string> = {
  chrome: "Chrome",
  Chrome: "Chrome",
  "Grok Bot": "Grok Bot",
  "com.android.launcher": "Launcher",
  "com.whatsapp": "WhatsApp",
  "com.instagram.android": "Instagram",
  "in.swiggy.android": "Swiggy",
  "com.coloros.phonemanager": "Phone Manager",
};

export const DEVICE_LABEL: Record<DeviceKey, string> = {
  mac: "Mac",
  msi: "MSI",
  phone: "Phone",
};

export function hourFrac(ts: string): number | null {
  const m = ts.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

export function parseIso(ts: string): number {
  const normalized = ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  return Date.parse(normalized);
}

export function dayKey(ts: string): string | null {
  const m = ts.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function prettyDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function prettyDateShort(day: string, now = Date.now()): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  const mon = MONTHS[m - 1].slice(0, 3);
  const year = new Date(now).getFullYear();
  if (y === year) return `${d} ${mon}`;
  return `${d} ${mon} ${y}`;
}

export function prettyDateRange(days: string[]): string {
  if (!days.length) return "";
  if (days.length === 1) return prettyDate(days[0]);
  const first = days[0];
  const last = days[days.length - 1];
  const [y1, m1, d1] = first.split("-").map(Number);
  const [y2, m2, d2] = last.split("-").map(Number);
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y1}`;
  return `${prettyDate(first)} – ${prettyDate(last)}`;
}

export function prettyTime(ts: string): string {
  const m = ts.match(/T(\d{2}):(\d{2})/);
  if (!m) return "";
  let hour = Number(m[1]);
  const min = m[2];
  const suffix = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12;
  return `${hour}:${min} ${suffix}`;
}

export function prettyClock(ts: string): string {
  const m = ts.match(/T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return prettyTime(ts);
  return `${m[1]}:${m[2]}:${m[3]}`;
}

export function prettyHourChip(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  if (wrapped === 0) return "12am";
  if (wrapped === 12) return "12pm";
  if (wrapped < 12) return `${wrapped}am`;
  return `${wrapped - 12}pm`;
}

export function prettyHourTick(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  if (wrapped === 0) return "12 am";
  if (wrapped === 12) return "12 pm";
  if (wrapped < 12) return `${wrapped} am`;
  return `${wrapped - 12} pm`;
}

export function prettyDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function splitDuration(minutes: number): { hours: number; mins: number; underHour: boolean } {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return { hours: 0, mins: total, underHour: true };
  return { hours: Math.floor(total / 60), mins: total % 60, underHour: false };
}

export function prettyApp(name: string): string {
  if (!name) return "Unknown";
  if (APP_NAMES[name]) return APP_NAMES[name];
  if (name.includes(".")) {
    const last = name.split(".").pop() || name;
    return last.charAt(0).toUpperCase() + last.slice(1);
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function deviceKey(name: string): DeviceKey {
  const n = (name || "").toLowerCase();
  if (n.includes("msi") || n.includes("windows") || n === "win") return "msi";
  if (n.includes("phone") || n.includes("android")) return "phone";
  if (n === "mac" || n.includes("darwin") || n.includes("macbook")) return "mac";
  return "mac";
}

export function sampleDetail(sample: { title?: string; url?: string; bundle?: string; explicit: boolean }): string {
  const bits: string[] = [];
  if (sample.title) bits.push(sample.title);
  if (sample.url) bits.push(sample.url.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  if (sample.bundle && sample.bundle !== sample.title) bits.push(sample.bundle);
  bits.push(sample.explicit ? "timed session" : "estimated stretch");
  return bits.join(" · ");
}

export function prettyUpdated(iso: string | null): string {
  if (!iso) return "";
  const day = dayKey(iso);
  const time = prettyTime(iso);
  if (!day || !time) return iso;
  return `${prettyDate(day)}, ${time}`;
}
