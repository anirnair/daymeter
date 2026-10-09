import { describe, expect, it } from "vitest";
import { classifyApp } from "./classify";
import { hourFrac, parseIso } from "./format";
import {
  freshnessFromData,
  freshnessParts,
  lagSeconds,
  prettyLag,
  prettyLagMs,
} from "./freshness";
import type { Sample } from "./types";

const NOW = Date.parse("2026-09-15T12:30:00Z");

function sample(ts: string, key: Sample["key"], app: string): Sample {
  return {
    ts,
    device: key,
    app,
    key,
    ms: parseIso(ts),
    h: hourFrac(ts) ?? 0,
    id: ts,
    minutes: 5,
    cls: classifyApp(app),
  };
}

describe("prettyLag", () => {
  it("stays relative past 36h so a date stamp cannot look current", () => {
    expect(prettyLag("2026-09-15T12:29:20Z", NOW)).toBe("just now");
    expect(prettyLag("2026-09-15T12:10:00Z", NOW)).toBe("20 min ago");
    expect(prettyLag("2026-09-15T07:30:00Z", NOW)).toBe("5h ago");
    expect(prettyLag("2026-09-14T00:32:48+05:30", NOW)).toBe("41h ago");
    expect(prettyLag("2026-09-12T00:23:16+0530", NOW)).toBe("3d ago");
    expect(prettyLag("2026-09-11T21:51:54+0530", NOW)).toBe("3d ago");
  });

  it("treats +0530 and +05:30 as the same instant", () => {
    expect(lagSeconds("2026-09-14T00:32:48+0530", NOW)).toBe(
      lagSeconds("2026-09-14T00:32:48+05:30", NOW),
    );
  });

  it("ages a loaded view against now", () => {
    expect(prettyLagMs(NOW - 15_000, NOW)).toBe("just now");
    expect(prettyLagMs(NOW - 10 * 60_000, NOW)).toBe("10 min ago");
  });
});

describe("freshnessFromData", () => {
  it("takes device clocks from the newest look, not the file's lastUpdated", () => {
    const freshness = freshnessFromData({
      samples: [
        sample("2026-09-11T21:51:54+0530", "mac", "Grok Bot"),
        sample("2026-09-11T22:57:15+0530", "msi", "chrome"),
      ],
      phones: {
        "2026-09-12": {
          day: "2026-09-12",
          hours: 0.28,
          top: [],
          switches: 126,
          ts: "2026-09-12T00:22:51+05:30",
        },
      },
      lastUpdated: "2026-09-12T00:23:16+0530",
      source: "seed",
      asOf: NOW,
    });
    expect(freshness.devices.mac).toBe("2026-09-11T21:51:54+0530");
    expect(freshness.devices.msi).toBe("2026-09-11T22:57:15+0530");
    expect(freshness.devices.phone).toBe("2026-09-12T00:22:51+05:30");
    expect(freshness.lastEvent).toBe("2026-09-12T00:22:51+05:30");
  });

  it("keeps live device stamps when the feed already split them", () => {
    const freshness = freshnessFromData({
      samples: [sample("2026-09-11T21:51:54+0530", "mac", "Grok Bot")],
      phones: {},
      lastUpdated: "2026-09-14T00:32:48+05:30",
      source: "origin",
      asOf: NOW,
      devices: {
        mac: "2026-09-11T21:51:54+0530",
        msi: "2026-09-11T22:57:15+0530",
        phone: "2026-09-14T00:32:48+05:30",
      },
    });
    expect(freshness.source).toBe("origin");
    expect(freshness.lastEvent).toBe("2026-09-14T00:32:48+05:30");
    expect(freshnessParts(freshness, NOW).map((part) => part.text)).toEqual([
      "origin",
      "checked just now",
      "newest 41h ago",
      "Mac 3d ago",
      "MSI 3d ago",
      "Phone 41h ago",
    ]);
  });

  it("anchors a snapshot newer-event line with the clock after 36h", () => {
    const freshness = freshnessFromData({
      samples: [sample("2026-09-11T22:57:15+0530", "msi", "chrome")],
      phones: {
        "2026-09-12": {
          day: "2026-09-12",
          hours: 0.28,
          top: [],
          switches: 126,
          ts: "2026-09-12T00:22:51+05:30",
        },
      },
      lastUpdated: "2026-09-12T00:23:16+0530",
      asOf: NOW,
    });
    const newest = freshnessParts(freshness, NOW).find((part) => part.key === "newest");
    expect(newest?.text).toBe("newest 3d ago (12 Sep, 12:22 am)");
  });
});
