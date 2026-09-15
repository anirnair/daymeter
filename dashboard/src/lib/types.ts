export type DeviceKey = "mac" | "msi" | "phone";

export type AppClass = "browser" | "chat" | "social" | "food" | "system" | "other";

export type Band = "all" | "morning" | "afternoon" | "evening" | "night";

export type RawSample = {
  ts: string;
  device: string;
  app: string;
};

export type Sample = RawSample & {
  key: DeviceKey;
  ms: number;
  h: number;
  id: string;
  minutes: number;
  cls: AppClass;
};

export type PhoneReport = {
  day: string;
  hours: number;
  top: string[];
  switches: number | null;
  ts?: string | null;
};

export type FreshnessSource = "live" | "origin" | "seed";

export type Freshness = {
  source: FreshnessSource;
  /** Epoch ms when this view was loaded or last polled. */
  asOf: number;
  /** Newest look or report among the devices. */
  lastEvent: string | null;
  lastUpdated: string | null;
  devices: { mac: string | null; msi: string | null; phone: string | null };
};

export type DaymeterData = {
  samples: Sample[];
  phones: Record<string, PhoneReport>;
  days: string[];
  lastUpdated: string | null;
  freshness: Freshness;
};

export type Slice = {
  device: DeviceKey | "all";
  app: string | null;
  cls: AppClass | "all";
  hour: number | null;
  band: Band;
  overlap: boolean;
};

export type Insight = {
  id: string;
  kicker: string;
  title: string;
  detail: string;
  slice?: Partial<Slice>;
};
