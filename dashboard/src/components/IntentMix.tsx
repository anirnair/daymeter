import clsx from "clsx";
import { prettyDuration } from "../lib/format";
import { INTENT_LABEL } from "../lib/intent";
import type { Intent } from "../lib/types";

type Row = { intent: Intent; minutes: number };

type Props = {
  rows: Row[];
  selected: Intent | "all";
  onSelect: (intent: Intent | "all") => void;
};

export function IntentMix({ rows, selected, onSelect }: Props) {
  const total = rows.reduce((n, row) => n + row.minutes, 0);
  if (!total) {
    return (
      <section className="section">
        <h2>make / consume / life</h2>
        <div className="empty">No timed apps in this slice.</div>
      </section>
    );
  }

  return (
    <section className="section">
      <h2>make / consume / life</h2>
      <div className="intent-track" aria-hidden="true">
        {rows.map((row) => (
          <i
            key={row.intent}
            className={row.intent}
            style={{ width: `${(row.minutes / total) * 100}%` }}
          />
        ))}
      </div>
      {rows.map((row) => {
        const pct = Math.round((row.minutes / total) * 100);
        return (
          <button
            key={row.intent}
            type="button"
            className="tool-row"
            aria-pressed={selected === row.intent}
            onClick={() => onSelect(selected === row.intent ? "all" : row.intent)}
          >
            <span className={clsx("name", row.intent)}>{INTENT_LABEL[row.intent]}</span>
            <span className="bar-track">
              <span className={clsx("bar-fill", row.intent)} style={{ width: `${Math.max(4, pct)}%` }} />
            </span>
            <span className="bar-n">
              {prettyDuration(row.minutes)} · {pct}%
            </span>
          </button>
        );
      })}
      <div className="empty">phone named-apps without clocks share leftover reported minutes evenly</div>
    </section>
  );
}
