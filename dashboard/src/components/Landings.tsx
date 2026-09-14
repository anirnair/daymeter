import clsx from "clsx";
import { CLASS_LABEL, classifyApp } from "../lib/classify";
import { DEVICE_LABEL, prettyApp, prettyDuration } from "../lib/format";
import { INTENT_LABEL } from "../lib/intent";
import type { Landing } from "../lib/clock";

type Props = {
  rows: Landing[];
  selected: string | null;
  onSelect: (app: string | null) => void;
};

export function Landings({ rows, selected, onSelect }: Props) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((row) => row.landings), 1);
  return (
    <section className="section">
      <h2>landings</h2>
      <div className="empty">how many times the front app changed onto this one</div>
      {rows.map((row) => (
        <button
          key={row.app}
          type="button"
          className="tool-row"
          aria-pressed={selected === row.app}
          onClick={() => onSelect(selected === row.app ? null : row.app)}
        >
          <span className="name">{prettyApp(row.app)}</span>
          <span className="bar-track">
            <span
              className={clsx("bar-fill", row.devices[0])}
              style={{ width: `${Math.max(4, (row.landings / max) * 100)}%` }}
            />
          </span>
          <span className="bar-n">
            {row.landings}× · {prettyDuration(row.minutes)}
          </span>
        </button>
      ))}
      <div className="empty">
        {rows
          .slice(0, 4)
          .map((row) => `${prettyApp(row.app)} ${INTENT_LABEL[row.intent]}/${CLASS_LABEL[classifyApp(row.app)]} on ${row.devices.map((d) => DEVICE_LABEL[d]).join("+")}`)
          .join(" · ")}
      </div>
    </section>
  );
}
