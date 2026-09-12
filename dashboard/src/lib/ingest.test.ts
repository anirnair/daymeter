import { describe, expect, it } from "vitest";
import { applyIngest, emptyLive, parseIngestBody, phonesFromSamples } from "./ingest";
import { applySampleSlice, EMPTY_SLICE } from "./filters";
import { generateBehavior } from "./behavior";
import { classifyApp } from "./classify";
import { estimateSampleMinutes } from "./metrics";
import { asSample } from "./load";
import type { Sample } from "./types";

describe("ingest parse", () => {
  it("reads a computer look, a Writer summary, and timed phone sessions", () => {
    const look = parseIngestBody(
      JSON.stringify({ ts: "2026-09-12T09:04:11+0530", device: "mac", app: "Safari", title: "Inbox", url: "https://mail.example" }),
    );
    expect(look.samples[0]?.app).toBe("Safari");
    expect(look.samples[0]?.url).toContain("mail.example");

    const summary = parseIngestBody(
      JSON.stringify({
        device: "phone",
        day: "2026-09-12",
        hours: 0.28,
        top: ["com.whatsapp"],
        switches: 126,
      }),
    );
    expect(summary.phones[0]?.switches).toBe(126);

    const sessions = parseIngestBody(
      JSON.stringify({
        device: "phone",
        sessions: [
          { ts: "2026-09-12T00:10:02+0530", app: "com.whatsapp", seconds: 40 },
          { ts: "2026-09-12T00:10:42+0530", end: "2026-09-12T00:11:02+0530", app: "com.instagram.android" },
        ],
      }),
    );
    expect(sessions.samples).toHaveLength(2);
    expect(sessions.samples[0]?.seconds).toBe(40);
    expect(sessions.samples[1]?.seconds).toBe(20);
  });

  it("reads TSV looks", () => {
    const parsed = parseIngestBody("2026-09-11T21:18:02+0530\tmac\tGrok Bot\n");
    expect(parsed.samples[0]?.app).toBe("Grok Bot");
  });
});

describe("live merge", () => {
  it("dedupes the same look and keeps a newer phone session", () => {
    const first = applyIngest(
      emptyLive(),
      parseIngestBody(JSON.stringify({ ts: "2026-09-12T09:00:00+0530", device: "MSI", app: "chrome" })),
      "2026-09-12T09:00:01+0530",
    );
    const second = applyIngest(
      first,
      parseIngestBody(
        JSON.stringify({
          ts: "2026-09-12T09:00:00+0530",
          device: "MSI",
          app: "chrome",
          url: "https://github.com",
        }),
      ),
      "2026-09-12T09:01:00+0530",
    );
    expect(second.samples).toHaveLength(1);
    expect(second.samples[0]?.url).toBe("https://github.com");
  });
});

describe("phone samples in the slice", () => {
  it("keeps timed phone sessions on the phone device cut and on their hour", () => {
    const raw = [
      { ts: "2026-09-12T00:10:02+0530", device: "phone", app: "com.whatsapp", seconds: 40 },
      { ts: "2026-09-11T21:18:02+0530", device: "mac", app: "Grok Bot" },
    ];
    const list = estimateSampleMinutes(
      raw.map((row, i) => asSample(row, i)).filter((s): s is Sample => s != null),
    );
    expect(list.some((s) => s.key === "phone" && s.explicit)).toBe(true);
    const phoneOnly = applySampleSlice(list, { ...EMPTY_SLICE, device: "phone" });
    expect(phoneOnly).toHaveLength(1);
    expect(phoneOnly[0]?.app).toBe("com.whatsapp");
    const midnight = applySampleSlice(list, { ...EMPTY_SLICE, hour: 0 });
    expect(midnight.every((s) => Math.floor(s.h) === 0)).toBe(true);
    expect(midnight.some((s) => s.key === "phone")).toBe(true);
  });
});

describe("second-order behavior", () => {
  it("names split attention, phone churn, and grain improvements from the real log", () => {
    const RAW = [
      { ts: "2026-09-11T21:18:02+0530", device: "mac", app: "Grok Bot" },
      { ts: "2026-09-11T21:19:19+0530", device: "MSI", app: "Grok Bot" },
      { ts: "2026-09-11T21:51:54+0530", device: "mac", app: "Grok Bot" },
      { ts: "2026-09-11T21:51:54+0530", device: "MSI", app: "chrome" },
      { ts: "2026-09-11T22:44:02+0530", device: "MSI", app: "chrome" },
      { ts: "2026-09-11T22:57:15+0530", device: "MSI", app: "chrome" },
    ];
    const list = estimateSampleMinutes(
      RAW.map((row, i) => asSample(row, i)).filter((s): s is Sample => s != null),
    );
    expect(list.every((s) => s.cls === classifyApp(s.app))).toBe(true);
    const notes = generateBehavior(
      list,
      {
        day: "2026-09-12",
        hours: 0.28,
        top: ["com.android.launcher", "com.whatsapp", "com.instagram.android", "in.swiggy.android"],
        switches: 126,
      },
      EMPTY_SLICE,
      ["2026-09-11", "2026-09-12"],
    );
    const text = notes.map((n) => `${n.kind}:${n.title} ${n.detail}`).join("\n");
    expect(text).toMatch(/waste:.*21:51:54/);
    expect(text).toMatch(/450\/hr/);
    expect(text).toMatch(/recovery:.*Mac goes quiet/);
    expect(text).toMatch(/improve:.*sessions have clocks/i);
    expect(notes.some((n) => n.kind === "insight")).toBe(true);
    expect(notes.some((n) => n.kind === "waste")).toBe(true);
    expect(notes.some((n) => n.kind === "recovery")).toBe(true);
    expect(notes.some((n) => n.kind === "improve")).toBe(true);
  });
});

describe("phone report merge", () => {
  it("keeps a Writer summary when sessions cover less of the day", () => {
    const live = applyIngest(
      emptyLive(),
      parseIngestBody(
        JSON.stringify({
          device: "phone",
          sessions: [{ ts: "2026-09-12T00:10:02+0530", app: "com.whatsapp", seconds: 40 }],
        }),
      ),
      "2026-09-12T00:12:00+0530",
    );
    const phones = phonesFromSamples(live.samples, {
      "2026-09-12": {
        day: "2026-09-12",
        hours: 0.28,
        top: ["com.android.launcher", "com.whatsapp"],
        switches: 126,
        sampled: false,
      },
    });
    expect(phones["2026-09-12"]?.sampled).toBe(true);
    expect(phones["2026-09-12"]?.hours).toBe(0.28);
    expect(phones["2026-09-12"]?.switches).toBe(126);
    expect(phones["2026-09-12"]?.top[0]).toBe("com.whatsapp");
    expect(phones["2026-09-12"]?.top).toContain("com.android.launcher");
  });
});
