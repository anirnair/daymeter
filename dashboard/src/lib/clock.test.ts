import { describe, expect, it } from "vitest";
import { classifyApp } from "./classify";
import { clockHours, dayShare, intentMinutes, landings, overlapStats } from "./clock";
import { classifyIntent } from "./intent";
import { estimateSampleMinutes } from "./metrics";
import { applySampleSlice, EMPTY_SLICE } from "./filters";
import type { Sample } from "./types";
import { hourFrac, parseIso } from "./format";

const RAW = [
  { ts: "2026-09-11T21:18:02+0530", device: "Anirudh-Nair-K4TWXC6H51.local", app: "Grok Bot", key: "mac" as const },
  { ts: "2026-09-11T21:19:19+0530", device: "MSI", app: "Grok Bot", key: "msi" as const },
  { ts: "2026-09-11T21:51:54+0530", device: "Anirudh-Nair-K4TWXC6H51.local", app: "Grok Bot", key: "mac" as const },
  { ts: "2026-09-11T21:51:54+0530", device: "MSI", app: "chrome", key: "msi" as const },
  { ts: "2026-09-11T22:44:02+0530", device: "MSI", app: "chrome", key: "msi" as const },
  { ts: "2026-09-11T22:57:15+0530", device: "MSI", app: "chrome", key: "msi" as const },
];

function samples(): Sample[] {
  const list: Sample[] = RAW.map((row, i) => ({
    ts: row.ts,
    device: row.device,
    app: row.app,
    key: row.key,
    ms: parseIso(row.ts),
    h: hourFrac(row.ts) ?? 0,
    id: `${row.ts}|${row.key}|${row.app}|${i}`,
    minutes: 5,
    cls: classifyApp(row.app),
    explicit: false,
  }));
  return estimateSampleMinutes(list);
}

describe("intent", () => {
  it("treats grok as make, instagram as consume, swiggy as life", () => {
    expect(classifyIntent("Grok Bot")).toBe("make");
    expect(classifyIntent("chrome")).toBe("make");
    expect(classifyIntent("com.instagram.android")).toBe("consume");
    expect(classifyIntent("in.swiggy.android")).toBe("life");
    expect(classifyIntent("com.android.launcher")).toBe("system");
  });
});

describe("clock", () => {
  it("paints hour 21 on Mac and MSI and hour 22 on MSI only", () => {
    const hours = clockHours(samples());
    expect(hours[21].mac).toBeGreaterThan(0);
    expect(hours[21].msi).toBeGreaterThan(0);
    expect(hours[22].mac).toBe(0);
    expect(hours[22].msi).toBeGreaterThan(0);
  });

  it("counts dual-machine overlap from capped look windows", () => {
    const stats = overlapStats(samples());
    expect(stats.macMsi).toBeGreaterThan(10);
    expect(stats.triple).toBe(0);
  });

  it("counts chrome landings when MSI switches off Grok", () => {
    const rows = landings(samples());
    const chrome = rows.find((row) => row.app === "chrome");
    const grok = rows.find((row) => row.app === "Grok Bot");
    expect(chrome?.landings).toBe(1);
    expect(grok?.landings).toBeGreaterThanOrEqual(2);
  });

  it("make filter keeps grok and chrome", () => {
    const out = applySampleSlice(samples(), { ...EMPTY_SLICE, intent: "make" });
    expect(out.length).toBe(6);
  });

  it("names Writer apps as mix landings using leftover reported minutes", () => {
    const rows = landings(samples(), {
      day: "2026-09-12",
      hours: 6.53,
      top: ["com.instagram.android", "com.whatsapp"],
      switches: 1082,
    });
    const ig = rows.find((row) => row.app === "com.instagram.android");
    expect(ig?.minutes).toBeGreaterThan(100);
    expect(ig?.devices).toContain("phone");
    expect(dayShare(6.53 * 60)).toBeCloseTo(6.53 / 24);
  });

  it("splits leftover phone hours across named apps", () => {
    const rows = intentMinutes(samples(), {
      day: "2026-09-12",
      hours: 0.28,
      top: ["com.whatsapp", "com.instagram.android", "in.swiggy.android"],
      switches: 126,
    });
    const consume = rows.find((row) => row.intent === "consume")?.minutes ?? 0;
    const life = rows.find((row) => row.intent === "life")?.minutes ?? 0;
    expect(consume).toBeGreaterThan(5);
    expect(life).toBeGreaterThan(3);
  });
});
