import clsx from "clsx";
import { FloatCard } from "./FloatCard";
import { CLASS_LABEL, classifyApp } from "../lib/classify";
import { DEVICE_LABEL, prettyApp, prettyDuration } from "../lib/format";
import type { DeviceKey } from "../lib/types";

type Row = {
  app: string;
  minutes: number;
  devices: DeviceKey[];
};

type Props = {
  rows: Row[];
  selected: string | null;
  onSelect: (app: string | null) => void;
  maxMinutes: number;
};

export function ToolsChart({ rows, selected, onSelect, maxMinutes }: Props) {
  if (!rows.length) return <div className="empty">No apps in this view.</div>;
  const max = Math.max(maxMinutes, 1);

  return (
    <div>
      {rows.map((row) => {
        const tone = row.devices[0];
        const width = `${Math.max(4, (row.minutes / max) * 100)}%`;
        const deviceLine = row.devices.map((d) => DEVICE_LABEL[d]).join(" and ");
        return (
          <FloatCard
            key={row.app}
            title={prettyApp(row.app)}
            lines={[
              prettyDuration(row.minutes),
              `${CLASS_LABEL[classifyApp(row.app)]} · on ${deviceLine}`,
              "time estimated from how long the app stayed in front",
            ]}
          >
            <button
              type="button"
              className="tool-row"
              aria-pressed={selected === row.app}
              onClick={() => onSelect(selected === row.app ? null : row.app)}
            >
              <span className="name">{prettyApp(row.app)}</span>
              <span className="bar-track">
                <span className={clsx("bar-fill", tone)} style={{ width }} />
              </span>
              <span className="bar-n">{prettyDuration(row.minutes)}</span>
            </button>
          </FloatCard>
        );
      })}
    </div>
  );
}
