export type DeviceKey = "mac" | "msi" | "phone";

export type AppClass = "browser" | "chat" | "social" | "food" | "system" | "other";

export type Intent = "make" | "consume" | "life" | "system";

export type Band = "all" | "morning" | "afternoon" | "evening" | "night";

export type RawSample = {
  ts: string;
  device: string;
  app: string;
  title?: string;
  url?: string;
  bundle?: string;
  end?: string;
  seconds?: number;
  className?: string;
};

export type Sample = RawSample & {
  key: DeviceKey;
  ms: number;
  h: number;
  id: string;
  minutes: number;
  cls: AppClass;
  explicit: boolean;
};

export type PhoneReport = {
  day: string;
  hours: number;
  top: string[];
  switches: number | null;
  sampled?: boolean;
};

export type Freshness = {
  source: "live" | "origin" | "seed";
  lastIngest: string | null;
  lastUpdated: string | null;
  devices: Partial<Record<DeviceKey, string | null>>;
  writable: boolean;
};

export type BehaviorKind = "insight" | "waste" | "recovery" | "improve";

export type BehaviorNote = {
  id: string;
  kind: BehaviorKind;
  kicker: string;
  title: string;
  detail: string;
  evidence: string[];
  slice?: Partial<Slice>;
};

export type DaymeterData = {
  samples: Sample[];
  phones: Record<string, PhoneReport>;
  days: string[];
  lastUpdated: string | null;
  freshness: Freshness;
  notes: BehaviorNote[];
};

export type Slice = {
  device: DeviceKey | "all";
  app: string | null;
  cls: AppClass | "all";
  intent: Intent | "all";
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

export type LiveStore = {
  version: 1;
  samples: RawSample[];
  phones: Record<string, PhoneReport>;
  lastIngest: string | null;
  lastUpdated: string | null;
  devices: Partial<Record<DeviceKey, string>>;
  notes: BehaviorNote[];
  notesAt: string | null;
};

export type Meta = {
  samples?: RawSample[];
  lastUpdated?: string;
  day?: string;
  phone?: { hours: number; top?: string[]; switches?: number; day?: string };
  phones?: Record<string, PhoneReport | { hours: number; top?: string[]; switches?: number; day?: string }>;
  sentences?: Record<string, string | null>;
};
