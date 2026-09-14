import { describe, expect, it } from "vitest";
import { prettyDateShort } from "./format";
import { deviceLagLine, deviceLagParts, prettyLag } from "./freshness";

const NOW = Date.parse("2026-09-14T19:24:00+05:30");

describe("prettyLag", () => {
  it("uses a short calendar stamp after 36h so the freshness line can wrap on device units", () => {
    expect(prettyLag("2026-09-12T00:22:51+05:30", NOW)).toBe("12 Sep, 12:22 am");
    expect(prettyLag("2026-09-11T22:57:15+0530", NOW)).toBe("11 Sep, 10:57 pm");
  });

  it("keeps relative labels when the look is recent", () => {
    expect(prettyLag("2026-09-14T19:23:30+05:30", NOW)).toBe("just now");
    expect(prettyLag("2026-09-14T18:50:00+05:30", NOW)).toBe("34m ago");
    expect(prettyLag("2026-09-13T19:24:00+05:30", NOW)).toBe("24h ago");
  });
});

describe("prettyDateShort", () => {
  it("drops the year for the current year and keeps it otherwise", () => {
    expect(prettyDateShort("2026-09-12", NOW)).toBe("12 Sep");
    expect(prettyDateShort("2025-12-31", NOW)).toBe("31 Dec 2025");
  });
});

describe("deviceLagParts", () => {
  it("keeps each device as its own nowrap unit", () => {
    const devices = {
      mac: "2026-09-11T21:18:02+0530",
      msi: "2026-09-11T22:57:15+0530",
      phone: "2026-09-12T00:22:51+05:30",
    };
    expect(deviceLagParts(devices, NOW)).toEqual([
      { key: "mac", label: "Mac", lag: "11 Sep, 9:18 pm" },
      { key: "msi", label: "MSI", lag: "11 Sep, 10:57 pm" },
      { key: "phone", label: "Phone", lag: "12 Sep, 12:22 am" },
    ]);
    expect(deviceLagLine(devices, NOW)).toBe(
      "Mac 11 Sep, 9:18 pm · MSI 11 Sep, 10:57 pm · Phone 12 Sep, 12:22 am",
    );
  });
});
