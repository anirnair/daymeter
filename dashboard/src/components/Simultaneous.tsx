import { prettyDuration } from "../lib/format";
import type { OverlapStats } from "../lib/clock";
import type { Slice } from "../lib/types";

type Props = {
  stats: OverlapStats;
  onSlice: (next: Partial<Slice>) => void;
};

export function Simultaneous({ stats, onSlice }: Props) {
  const rows = [
    { id: "dual", label: "two devices at once", minutes: stats.dual, slice: { overlap: true } as Partial<Slice> },
    { id: "mac-msi", label: "Mac + MSI", minutes: stats.macMsi, slice: { overlap: true } as Partial<Slice> },
    { id: "mac-phone", label: "Mac + Phone", minutes: stats.macPhone, slice: { overlap: true, device: "all" as const } },
    { id: "msi-phone", label: "MSI + Phone", minutes: stats.msiPhone, slice: { overlap: true } },
    { id: "triple", label: "all three", minutes: stats.triple, slice: { overlap: true } },
  ].filter((row) => row.minutes > 0.05);

  return (
    <section className="section">
      <h2>simultaneous</h2>
      {rows.length ? (
        rows.map((row) => (
          <button key={row.id} type="button" className="stat-row" onClick={() => onSlice(row.slice)}>
            <span className="name">{row.label}</span>
            <span className="bar-n">{prettyDuration(row.minutes)}</span>
          </button>
        ))
      ) : (
        <div className="empty">No overlapping stretches in this slice. Dual-device time needs looks that share a clock.</div>
      )}
    </section>
  );
}
