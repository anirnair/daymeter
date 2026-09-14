import clsx from "clsx";
import { FloatCard } from "./FloatCard";
import { CLASS_LABEL, classifyApp } from "../lib/classify";
import { prettyApp, prettyDuration } from "../lib/format";
import type { DeviceKey, PhoneReport } from "../lib/types";

type JumpRow = { name: string; jumps: number; tone: "mac" | "msi" | "phone" };
type AppRow = { app: string; minutes: number; devices: DeviceKey[] };

type Props = {
  phone: PhoneReport;
  computerJumps: JumpRow[];
  selected: string | null;
  onSelect: (app: string | null) => void;
  sampledMinutes?: AppRow[];
};

export function PhoneBreakdown({
  phone,
  computerJumps,
  selected,
  onSelect,
  sampledMinutes = [],
}: Props) {
  const sessionMin = sampledMinutes.reduce((n, row) => n + row.minutes, 0);
  const minutes = Math.max(sessionMin, phone.hours * 60);
  const seconds = minutes * 60;
  const every =
    phone.switches && phone.switches > 0
      ? Math.max(1, Math.round(seconds / phone.switches))
      : null;
  const phoneJumps = phone.switches
    ? Math.round(phone.switches / Math.max(minutes / 60, 0.01))
    : 0;
  const rows: JumpRow[] = [
    ...computerJumps,
    { name: "Phone", jumps: phoneJumps, tone: "phone" as const },
  ].filter((row) => row.jumps > 0);
  const max = Math.max(...rows.map((r) => r.jumps), 1);
  const sampled = phone.sampled || sampledMinutes.length > 0;
  const appRows = sampledMinutes.length
    ? sampledMinutes
    : phone.top.map((app) => ({ app, minutes: 0, devices: ["phone" as const] }));
  const maxApp = Math.max(...appRows.map((row) => row.minutes), 1);

  return (
    <>
      <div className="empty">
        {prettyDuration(minutes)}
        {phone.switches != null ? ` · ${phone.switches} jumps` : ""}
        {every != null ? ` · about every ${every} seconds` : ""}
        {sampled ? " · timed sessions" : " · day-summary"}
      </div>
      {rows.length > 0 ? (
        <div className="section">
          <h2>jumps per hour</h2>
          {rows.map((row) => (
            <FloatCard
              key={row.name}
              title={row.name}
              lines={[
                `${row.jumps} jumps per hour`,
                row.name === "Phone"
                  ? sampled
                    ? "from timestamped sessions"
                    : "reported by Writer"
                  : "from app changes between looks",
              ]}
            >
              <button type="button" className="tool-row">
                <span className="name">{row.name}</span>
                <span className="bar-track">
                  <span
                    className={clsx("bar-fill", row.tone)}
                    style={{ width: `${row.jumps <= 0 ? 0 : Math.max(4, (row.jumps / max) * 100)}%` }}
                  />
                </span>
                <span className="bar-n">{row.jumps}/hr</span>
              </button>
            </FloatCard>
          ))}
        </div>
      ) : null}
      <div className="section">
        <h2>{sampled ? "apps on phone" : "apps in the mix"}</h2>
        {appRows.map((row) => (
          <FloatCard
            key={row.app}
            title={prettyApp(row.app)}
            lines={[
              `${CLASS_LABEL[classifyApp(row.app)]} · Phone`,
              sampled && row.minutes
                ? prettyDuration(row.minutes)
                : `${prettyDuration(minutes)} total, not split by app`,
              phone.switches != null
                ? `${phone.switches} jumps across ${appRows.length} apps`
                : sampled
                  ? "timed session"
                  : "reported by Writer",
            ]}
          >
            <button
              type="button"
              className="phone-app"
              aria-pressed={selected === row.app}
              onClick={() => onSelect(selected === row.app ? null : row.app)}
            >
              <span className="name">{prettyApp(row.app)}</span>
              {sampled && row.minutes ? (
                <span className="bar-track">
                  <span
                    className="bar-fill phone"
                    style={{ width: `${Math.max(4, (row.minutes / maxApp) * 100)}%` }}
                  />
                </span>
              ) : null}
              <span className="bar-n">
                {sampled && row.minutes ? prettyDuration(row.minutes) : CLASS_LABEL[classifyApp(row.app)]}
              </span>
            </button>
          </FloatCard>
        ))}
      </div>
    </>
  );
}
