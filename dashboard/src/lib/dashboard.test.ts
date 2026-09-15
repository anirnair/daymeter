import { describe, expect, it } from "vitest";
import { classifyApp } from "./classify";
import { classifyIntent } from "./intent";
import { applyPhoneSlice, applySampleSlice, EMPTY_SLICE } from "./filters";
import { generateInsights } from "./insights";
import { coincidences, estimateSampleMinutes, hourHistogram, overlapHalfHours } from "./metrics";
import type { PhoneReport, Sample, Slice } from "./types";
import { parseIso, hourFrac } from "./format";

const PHONE: PhoneReport = {
  day: "2026-09-12",
  hours: 0.28,
  top: [
    "com.android.launcher",
    "com.whatsapp",
    "com.instagram.android",
    "in.swiggy.android",
    "com.coloros.phonemanager",
  ],
  switches: 126,
};

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

function slice(partial: Partial<Slice>): Slice {
  return { ...EMPTY_SLICE, ...partial };
}

describe("classify", () => {
  it("tags chrome as browser and grok as chat", () => {
    expect(classifyApp("chrome")).toBe("browser");
    expect(classifyApp("Grok Bot")).toBe("chat");
    expect(classifyApp("com.whatsapp")).toBe("social");
    expect(classifyApp("in.swiggy.android")).toBe("food");
    expect(classifyApp("com.android.launcher")).toBe("system");
    expect(classifyIntent("com.whatsapp")).toBe("consume");
  });
});

describe("filters", () => {
  it("keeps chrome-only looks on MSI when sliced to browser", () => {
    const out = applySampleSlice(samples(), slice({ cls: "browser" }));
    expect(out.every((s) => s.app === "chrome")).toBe(true);
    expect(out.every((s) => s.key === "msi")).toBe(true);
    expect(out).toHaveLength(3);
  });

  it("hour 21 keeps Grok and the same-second Chrome look", () => {
    const out = applySampleSlice(samples(), slice({ hour: 21 }));
    expect(out.map((s) => `${s.key}:${s.app}`).sort()).toEqual(
      ["mac:Grok Bot", "mac:Grok Bot", "msi:Grok Bot", "msi:chrome"].sort(),
    );
  });

  it("hour 22 is MSI Chrome only", () => {
    const out = applySampleSlice(samples(), slice({ hour: 22 }));
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.key === "msi" && s.app === "chrome")).toBe(true);
  });

  it("drops phone when an hour is set, because phone is not hourly", () => {
    expect(applyPhoneSlice(PHONE, slice({ hour: 21 }))).toBeNull();
    expect(applyPhoneSlice(PHONE, slice({ device: "mac" }))).toBeNull();
    expect(applyPhoneSlice(PHONE, slice({ cls: "social" }))?.top).toEqual([
      "com.whatsapp",
      "com.instagram.android",
    ]);
  });

  it("both-awake keeps the 21:51 half-hour", () => {
    const out = applySampleSlice(samples(), slice({ overlap: true }));
    expect(out.some((s) => s.ts.includes("21:51:54"))).toBe(true);
    expect(out.every((s) => Math.floor(s.h) === 21)).toBe(true);
  });
});

describe("metrics", () => {
  it("flags the same-second Mac Grok / MSI Chrome beat", () => {
    const hits = coincidences(samples());
    expect(hits).toHaveLength(1);
    expect(hits[0].mac.app).toBe("Grok Bot");
    expect(hits[0].msi.app).toBe("chrome");
  });

  it("puts both devices in the 21.5 half-hour bucket", () => {
    const both = overlapHalfHours(samples());
    expect(both.has(21.5)).toBe(true);
  });

  it("hour histogram separates 9pm from 10pm", () => {
    const rows = hourHistogram(samples());
    const nine = rows.find((r) => r.hour === 21);
    const ten = rows.find((r) => r.hour === 22);
    expect(nine?.mac).toBe(2);
    expect(nine?.msi).toBe(2);
    expect(ten?.mac).toBe(0);
    expect(ten?.msi).toBe(2);
  });
});

describe("insights", () => {
  it("reads a calendar split, dual-machine beat, MSI handoff, and phone churn", () => {
    const all = samples();
    const rows = generateInsights(all, PHONE, EMPTY_SLICE, ["2026-09-11", "2026-09-12"]);
    const text = rows.map((r) => `${r.title} ${r.detail}`).join("\n");
    expect(text).toMatch(/next calendar day/i);
    expect(text).toMatch(/both machines/i);
    expect(text).toMatch(/Chrome on MSI/i);
    expect(text).toMatch(/Mac goes quiet/i);
    expect(text).toMatch(/126 jumps/i);
    expect(text).toMatch(/not collected/i);
  });

  it("hour slice names the exact apps and clocks", () => {
    const rows = generateInsights(samples(), PHONE, slice({ hour: 22 }), ["2026-09-11"]);
    const text = rows.map((r) => `${r.title} ${r.detail}`).join("\n");
    expect(text).toMatch(/22:44:02/);
    expect(text).toMatch(/22:57:15/);
    expect(text).toMatch(/Chrome/);
    expect(rows.some((r) => r.id === "phone-churn")).toBe(false);
  });

  it("empty slice says so instead of inventing a day", () => {
    const rows = generateInsights(samples(), PHONE, slice({ hour: 7 }), ["2026-09-11"]);
    expect(rows[0]?.id).toBe("empty-slice");
  });
});
