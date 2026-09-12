import clsx from "clsx";
import { FloatCard } from "./FloatCard";
import { CLASS_LABEL, classifyApp } from "../lib/classify";
import { prettyApp, prettyDuration } from "../lib/format";
import type { PhoneReport } from "../lib/types";

type JumpRow = { name: string; jumps: number; tone: "mac" | "msi" | "phone" };

type Props = {
  phone: PhoneReport;
  computerJumps: JumpRow[];
  selected: string | null;
  onSelect: (app: string | null) => void;
};

export function PhoneBreakdown({ phone, computerJumps, selected, onSelect }: Props) {
  const minutes = phone.hours * 60;
  const seconds = phone.hours * 3600;
  const every =
    phone.switches && phone.switches > 0
      ? Math.max(1, Math.round(seconds / phone.switches))
      : null;
  const phoneJumps = phone.switches
    ? Math.round(phone.switches / Math.max(phone.hours, 0.01))
    : 0;
  const rows: JumpRow[] = [
    ...computerJumps,
    { name: "Phone", jumps: phoneJumps, tone: "phone" as const },
  ].filter((row) => row.jumps > 0);
  const max = Math.max(...rows.map((r) => r.jumps), 1);

  return (
    <>
      <div className="empty" style={{ textAlign: "center" }}>
        {prettyDuration(minutes)}
        {phone.switches != null ? ` · ${phone.switches} jumps` : ""}
        {every != null ? ` · about every ${every} seconds` : ""}
      </div>
      {rows.length > 0 ? (
        <div className="section" style={{ gap: 8 }}>
          <h2>jumps per hour</h2>
          {rows.map((row) => (
            <FloatCard
              key={row.name}
              title={row.name}
              lines={[
                `${row.jumps} jumps per hour`,
                row.name === "Phone" ? "reported by Writer" : "from app changes between looks",
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
      <div className="section" style={{ gap: 8 }}>
        <h2>apps in the mix</h2>
        {phone.top.map((app) => (
          <FloatCard
            key={app}
            title={prettyApp(app)}
            lines={[
              `${CLASS_LABEL[classifyApp(app)]} · in the mix on Phone`,
              `${prettyDuration(minutes)} total, not split by app`,
              phone.switches != null
                ? `${phone.switches} jumps across ${phone.top.length} apps`
                : "reported by Writer",
            ]}
          >
            <button
              type="button"
              className="phone-app"
              aria-pressed={selected === app}
              onClick={() => onSelect(selected === app ? null : app)}
            >
              <span className="name">{prettyApp(app)}</span>
              <span className="bar-n">{CLASS_LABEL[classifyApp(app)]}</span>
            </button>
          </FloatCard>
        ))}
      </div>
    </>
  );
}
