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
};

export type DaymeterData = {
  samples: Sample[];
  phones: Record<string, PhoneReport>;
  days: string[];
  lastUpdated: string | null;
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
