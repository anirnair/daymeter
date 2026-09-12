import type { Insight, Slice } from "../lib/types";

type Props = {
  rows: Insight[];
  onSlice: (next: Partial<Slice>) => void;
};

export function InsightBoard({ rows, onSlice }: Props) {
  if (!rows.length) return null;
  return (
    <section className="section">
      <h2>readings</h2>
      <div className="insights">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className="insight"
            onClick={() => {
              if (row.slice) onSlice(row.slice);
            }}
            disabled={!row.slice}
          >
            <div className="kicker">{row.kicker}</div>
            <div className="title">{row.title}</div>
            <div className="detail">{row.detail}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
