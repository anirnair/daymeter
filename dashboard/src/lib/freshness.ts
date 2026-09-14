import { dayKey, prettyDateShort, prettyTime } from "./format";
import type { DeviceKey, Freshness } from "./types";

export function emptyFreshness(lastUpdated: string | null = null): Freshness {
  return {
    source: "seed",
    lastIngest: null,
    lastUpdated,
    devices: { mac: null, msi: null, phone: null },
    writable: false,
  };
}

export function lagSeconds(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round((now - ms) / 1000));
}

export function prettyLag(iso: string | null, now = Date.now()): string {
  const lag = lagSeconds(iso, now);
  if (lag == null) return "no live ingest yet";
  if (lag < 90) return "just now";
  if (lag < 3600) return `${Math.round(lag / 60)}m ago`;
  if (lag < 36 * 3600) return `${Math.round(lag / 3600)}h ago`;
  const day = dayKey(iso || "");
  const time = prettyTime(iso || "");
  if (day && time) return `${prettyDateShort(day, now)}, ${time}`;
  return iso || "";
}

export type DeviceLagPart = { key: DeviceKey; label: string; lag: string };

export function deviceLagParts(
  devices: Freshness["devices"],
  now = Date.now(),
): DeviceLagPart[] {
  const parts: DeviceLagPart[] = [];
  (["mac", "msi", "phone"] as DeviceKey[]).forEach((key) => {
    const ts = devices[key];
    if (!ts) return;
    const label = key === "mac" ? "Mac" : key === "msi" ? "MSI" : "Phone";
    parts.push({ key, label, lag: prettyLag(ts, now) });
  });
  return parts;
}

export function deviceLagLine(devices: Freshness["devices"], now = Date.now()): string {
  return deviceLagParts(devices, now)
    .map((part) => `${part.label} ${part.lag}`)
    .join(" · ");
}
