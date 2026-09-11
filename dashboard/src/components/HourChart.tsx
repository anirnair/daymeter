import { FloatCard } from "./FloatCard";
import { DEVICE_LABEL, prettyHourTick } from "../lib/format";
import type { Sample } from "../lib/types";

type Props = {
  samples: Sample[];
};

export function HourChart({ samples }: Props) {
  if (!samples.length) return null;
  const hours = new Map<number, { mac: number; msi: number }>();
  for (const s of samples) {
    const h = Math.floor(s.h);
    const cur = hours.get(h) ?? { mac: 0, msi: 0 };
    if (s.key === "mac" || s.key === "msi") cur[s.key] += 1;
    hours.set(h, cur);
  }
  const keys = [...hours.keys()].sort((a, b) => a - b);
  const max = Math.max(...keys.map((h) => {
    const v = hours.get(h)!;
    return v.mac + v.msi;
  }), 1);

  return (
    <div className="hours" aria-label="looks by hour">
      {keys.map((h) => {
        const v = hours.get(h)!;
        const total = v.mac + v.msi;
        return (
          <FloatCard
            key={h}
            title={prettyHourTick(h)}
            lines={[
              `${total} look${total === 1 ? "" : "s"}`,
              v.mac ? `${DEVICE_LABEL.mac} ${v.mac}` : "",
              v.msi ? `${DEVICE_LABEL.msi} ${v.msi}` : "",
            ].filter(Boolean)}
          >
            <button type="button" aria-label={`${prettyHourTick(h)}, ${total} looks`}>
              <span className="col" style={{ height: `${(total / max) * 100}%` }}>
                {v.msi > 0 && <span className="seg msi" style={{ flexGrow: v.msi }} />}
                {v.mac > 0 && <span className="seg mac" style={{ flexGrow: v.mac }} />}
              </span>
              <span className="hlab">{prettyHourTick(h)}</span>
            </button>
          </FloatCard>
        );
      })}
    </div>
  );
}
