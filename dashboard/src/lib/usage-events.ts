/** Android UsageEvents.Event types we treat as foreground start/end. */
export const USAGE_FG = new Set([1, 23]); // MOVE_TO_FOREGROUND, ACTIVITY_RESUMED
export const USAGE_BG = new Set([2, 24, 25, 26]); // BACKGROUND, ACTIVITY_PAUSED/STOPPED/DESTROYED
export const USAGE_SCREEN_OFF = new Set([16, 17, 28]); // SCREEN_NON_INTERACTIVE, KEYGUARD_SHOWN, DEVICE_SHUTDOWN

export type UsageTick = {
  ms: number;
  ts: string;
  app: string;
  kind: "fg" | "bg" | "off";
  className?: string;
};

export type UsageSession = {
  ts: string;
  end: string;
  app: string;
  seconds: number;
  className?: string;
};

export function usageKindFromType(type: number): UsageTick["kind"] | null {
  if (USAGE_FG.has(type)) return "fg";
  if (USAGE_BG.has(type)) return "bg";
  if (USAGE_SCREEN_OFF.has(type)) return "off";
  return null;
}

export function sessionsFromTicks(ticks: UsageTick[], closeOpenAt?: { ts: string; ms: number }): UsageSession[] {
  const events = [...ticks].sort((a, b) => a.ms - b.ms || a.kind.localeCompare(b.kind));
  let current: { app: string; ts: string; ms: number; className?: string } | null = null;
  const sessions: UsageSession[] = [];

  const close = (end: string, endMs: number) => {
    if (!current) return;
    const seconds = (endMs - current.ms) / 1000;
    if (seconds > 0) {
      const row: UsageSession = {
        ts: current.ts,
        end,
        app: current.app,
        seconds,
      };
      if (current.className) row.className = current.className;
      sessions.push(row);
    }
    current = null;
  };

  for (const ev of events) {
    if (ev.kind === "off") {
      close(ev.ts, ev.ms);
      continue;
    }
    if (ev.kind === "fg") {
      if (current && current.app !== ev.app) close(ev.ts, ev.ms);
      else if (current && current.app === ev.app) continue;
      current = { app: ev.app, ts: ev.ts, ms: ev.ms, className: ev.className };
      continue;
    }
    if (current && (current.app === ev.app || !ev.app)) close(ev.ts, ev.ms);
  }

  if (closeOpenAt && current && closeOpenAt.ms > current.ms) {
    close(closeOpenAt.ts, closeOpenAt.ms);
  }
  return sessions;
}
