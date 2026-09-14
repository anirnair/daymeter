import type { BehaviorNote, Slice } from "../lib/types";

const TITLES: Record<BehaviorNote["kind"], string> = {
  insight: "insights",
  waste: "wastage",
  recovery: "recovery",
  improve: "improvement",
};

const ORDER: BehaviorNote["kind"][] = ["insight", "waste", "recovery", "improve"];

type Props = {
  notes: BehaviorNote[];
  onSlice: (next: Partial<Slice>) => void;
};

export function BehaviorBoard({ notes, onSlice }: Props) {
  if (!notes.length) return null;
  return (
    <section className="section">
      <h2>second order</h2>
      <div className="empty">inferences from the looks — not a score, and not extra events</div>
      {ORDER.map((kind) => {
        const rows = notes.filter((n) => n.kind === kind);
        if (!rows.length) return null;
        return (
          <div className="behavior-group" key={kind}>
            <h3 className={kind}>{TITLES[kind]}</h3>
            <div className="insights">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`insight ${kind}`}
                  onClick={() => {
                    if (row.slice) onSlice(row.slice);
                  }}
                  disabled={!row.slice}
                >
                  <div className="kicker">{row.kicker}</div>
                  <div className="title">{row.title}</div>
                  <div className="detail">{row.detail}</div>
                  {row.evidence.length ? (
                    <div className="evidence">
                      {row.evidence.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
