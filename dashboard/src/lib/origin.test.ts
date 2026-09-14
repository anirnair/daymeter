import { describe, expect, it } from "vitest";
import { storeFromOriginPayload } from "./origin";

const DASHBOARD11_JSON = {
  day: "2026-09-11",
  days: ["2026-09-11"],
  sentence: null,
  phone: {
    hours: 0.28,
    top: [
      "com.android.launcher",
      "com.whatsapp",
      "com.instagram.android",
      "in.swiggy.android",
      "com.coloros.phonemanager",
    ],
    day: "2026-09-12",
  },
  samples: [
    { ts: "2026-09-11T21:18:02+0530", device: "Anirudh-Nair-K4TWXC6H51.local", app: "Grok Bot" },
    { ts: "2026-09-11T21:19:19+0530", device: "MSI", app: "Grok Bot" },
    { ts: "2026-09-11T21:51:54+0530", device: "Anirudh-Nair-K4TWXC6H51.local", app: "Grok Bot" },
    { ts: "2026-09-11T21:51:54+0530", device: "MSI", app: "chrome" },
    { ts: "2026-09-11T22:44:02+0530", device: "MSI", app: "chrome" },
    { ts: "2026-09-11T22:57:15+0530", device: "MSI", app: "chrome" },
  ],
  lastUpdated: "2026-09-12T00:23:16+0530",
};

const REPORTED_TSV =
  "2026-09-12T00:22:51+05:30\treported\thours=0.28\ttop=com.android.launcher,com.whatsapp,com.instagram.android,in.swiggy.android,com.coloros.phonemanager\tswitches=126\n";

const SAMPLES_TSV = `2026-09-11T21:18:02+0530	Anirudh-Nair-K4TWXC6H51.local	Grok Bot
2026-09-11T21:19:19+0530	MSI	Grok Bot
2026-09-11T21:51:54+0530	Anirudh-Nair-K4TWXC6H51.local	Grok Bot
2026-09-11T21:51:54+0530	MSI	chrome
2026-09-11T22:44:02+0530	MSI	chrome
2026-09-11T22:57:15+0530	MSI	chrome
`;

describe("origin payload", () => {
  it("keeps Writer switches from TSV when data.json phone has none", () => {
    const store = storeFromOriginPayload({
      data: DASHBOARD11_JSON,
      reportedTsv: REPORTED_TSV,
      samplesTsv: SAMPLES_TSV,
    });
    const phone = store.phones["2026-09-12"];
    expect(phone?.hours).toBe(0.28);
    expect(phone?.switches).toBe(126);
    expect(phone?.top).toContain("com.whatsapp");
    expect(phone?.sampled).toBe(false);
    expect(store.samples).toHaveLength(6);
    expect(store.devices.phone).toContain("2026-09-12T00:22:51");
    expect(store.devices.mac).toBe("2026-09-11T21:51:54+0530");
    expect(store.devices.msi).toBe("2026-09-11T22:57:15+0530");
    expect(store.lastUpdated).toBe("2026-09-12T00:23:16+0530");
  });

  it("reads a later Writer hour total without inventing sessions", () => {
    const store = storeFromOriginPayload({
      data: {
        ...DASHBOARD11_JSON,
        phone: { ...DASHBOARD11_JSON.phone, hours: 1.1 },
      },
      reportedTsv:
        "2026-09-12T14:10:00+05:30\treported\thours=1.1\ttop=com.whatsapp\tswitches=210\n",
    });
    expect(store.phones["2026-09-12"]?.hours).toBe(1.1);
    expect(store.phones["2026-09-12"]?.switches).toBe(210);
    expect(store.samples.every((sample) => sample.device !== "phone")).toBe(true);
  });

  it("keeps title and URL columns on Origin computer looks", () => {
    const store = storeFromOriginPayload({
      samplesTsv:
        "2026-09-12T09:04:11+0530\tmac\tGoogle Chrome\tDaymeter live ingest\thttps://github.com/anirnair/daymeter\n",
    });
    expect(store.samples).toHaveLength(1);
    expect(store.samples[0]?.title).toBe("Daymeter live ingest");
    expect(store.samples[0]?.url).toContain("github.com/anirnair/daymeter");
  });
});
