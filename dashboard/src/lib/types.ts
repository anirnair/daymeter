export type DeviceKey = "mac" | "msi" | "phone";

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
