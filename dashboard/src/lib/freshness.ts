import { DEVICE_LABEL, parseIso, prettyUpdated } from "./format";
import type { DeviceKey, Freshness, FreshnessSource, PhoneReport, Sample } from "./types";

export function emptyFreshness(lastUpdated: string | null = null, asOf = Date.now()): Freshness {
  return {
    source: "seed",
    asOf,
    lastEvent: lastUpdated,
    lastUpdated,
    devices: { mac: null, msi: null, phone: null },
  };
}

export function lagSeconds(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const ms = parseIso(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round((now - ms) / 1000));
}

export function prettyLag(iso: string | null, now = Date.now()): string {
  const lag = lagSeconds(iso, now);
  if (lag == null) return "no look yet";
  return prettyLagSeconds(lag);
}

export function prettyLagSeconds(lag: number): string {
  if (lag < 90) return "just now";
  if (lag < 3600) {
    const mins = Math.max(1, Math.round(lag / 60));
    return `${mins} min ago`;
  }
  if (lag < 48 * 3600) {
    const hours = Math.max(1, Math.round(lag / 3600));
    return `${hours}h ago`;
  }
  const days = Math.max(2, Math.floor(lag / 86400));
  return `${days}d ago`;
}

export function prettyLagMs(ms: number | null, now = Date.now()): string {
  if (ms == null || !Number.isFinite(ms)) return "just now";
  return prettyLagSeconds(Math.max(0, Math.round((now - ms) / 1000)));
}

function latestSample(samples: Sample[], key: DeviceKey): string | null {
  let best: Sample | null = null;
  for (const sample of samples) {
    if (sample.key !== key) continue;
    if (!best || sample.ms > best.ms) best = sample;
  }
  return best?.ts ?? null;
}

function latestPhoneStamp(phones: Record<string, PhoneReport>, lastUpdated: string | null): string | null {
  const stamps = Object.values(phones)
    .map((phone) => phone.ts)
    .filter((ts): ts is string => Boolean(ts));
  if (stamps.length) return latestStamp(stamps);
  return Object.keys(phones).length ? lastUpdated : null;
}

export function latestStamp(values: Array<string | null | undefined>): string | null {
  const stamps = values.filter((value): value is string => Boolean(value));
  if (!stamps.length) return null;
  return stamps.slice().sort((a, b) => parseIso(a) - parseIso(b)).at(-1) ?? null;
}

export function freshnessFromData(input: {
  samples: Sample[];
  phones: Record<string, PhoneReport>;
  lastUpdated: string | null;
  source?: FreshnessSource;
  devices?: Freshness["devices"] | null;
  asOf?: number;
}): Freshness {
  const devices = {
    mac: input.devices?.mac ?? latestSample(input.samples, "mac"),
    msi: input.devices?.msi ?? latestSample(input.samples, "msi"),
    phone: input.devices?.phone ?? latestPhoneStamp(input.phones, input.lastUpdated),
  };
  const lastEvent = latestStamp([devices.mac, devices.msi, devices.phone]);
  return {
    source: input.source ?? "seed",
    asOf: input.asOf ?? Date.now(),
    lastEvent,
    lastUpdated: input.lastUpdated,
    devices,
  };
}

export type FreshnessPart = { key: string; text: string };

export function freshnessParts(freshness: Freshness, now = Date.now()): FreshnessPart[] {
  const parts: FreshnessPart[] = [
    {
      key: "source",
      text: freshness.source === "live" ? "live" : freshness.source === "origin" ? "origin" : "snapshot",
    },
    { key: "checked", text: `checked ${prettyLagMs(freshness.asOf, now)}` },
  ];
  if (freshness.lastEvent) {
    const lag = prettyLag(freshness.lastEvent, now);
    const when = prettyUpdated(freshness.lastEvent);
    const lagSec = lagSeconds(freshness.lastEvent, now) ?? 0;
    parts.push({
      key: "newest",
      text: lagSec >= 48 * 3600 && when ? `newest ${lag} (${when})` : `newest ${lag}`,
    });
  }
  (["mac", "msi", "phone"] as DeviceKey[]).forEach((key) => {
    const ts = freshness.devices[key];
    if (!ts) return;
    parts.push({ key, text: `${DEVICE_LABEL[key]} ${prettyLag(ts, now)}` });
  });
  return parts;
}
