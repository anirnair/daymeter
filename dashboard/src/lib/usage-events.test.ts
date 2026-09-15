import { describe, expect, it } from "vitest";
import { sessionsFromTicks, usageKindFromType } from "./usage-events";

describe("usage events", () => {
  it("maps modern Android types 23/24 the same way as 1/2", () => {
    expect(usageKindFromType(1)).toBe("fg");
    expect(usageKindFromType(23)).toBe("fg");
    expect(usageKindFromType(2)).toBe("bg");
    expect(usageKindFromType(24)).toBe("bg");
    expect(usageKindFromType(25)).toBe("bg");
    expect(usageKindFromType(28)).toBe("off");
  });

  it("builds timed sessions and closes on screen-off", () => {
    const sessions = sessionsFromTicks([
      { ms: 0, ts: "2026-09-15T09:00:00+05:30", app: "com.whatsapp", kind: "fg" },
      { ms: 40_000, ts: "2026-09-15T09:00:40+05:30", app: "com.instagram.android", kind: "fg" },
      { ms: 70_000, ts: "2026-09-15T09:01:10+05:30", app: "com.instagram.android", kind: "off" },
    ]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ app: "com.whatsapp", seconds: 40 });
    expect(sessions[1]).toMatchObject({ app: "com.instagram.android", seconds: 30 });
  });
});
