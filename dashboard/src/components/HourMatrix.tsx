import clsx from "clsx";
import { prettyHourChip } from "../lib/format";
import type { DeviceKey, Sample } from "../lib/types";

type Props = {
  samples: Sample[];
  hour: number | null;
  onHour: (hour: number | null) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const LANES: DeviceKey[] = ["mac", "msi"];

export function HourMatrix({ samples, hour, onHour }: Props) {
  const counts = new Map<string, number>();
  let max = 1;
  for (const s of samples) {
    const key = `${s.key}:${Math.floor(s.h)}`;
    const n = (counts.get(key) || 0) + 1;
    counts.set(key, n);
    if (n > max) max = n;
  }

  return (
    <section className="section">
      <h2>hour of day</h2>
      <div className="matrix">
        <div className="matrix-ticks">
          <span className="lab" />
          <div className="matrix-cells matrix-hours">
            {HOURS.map((h) => (
              <span key={h} className={clsx(h % 6 === 0 && "on")}>
                {h % 6 === 0 ? prettyHourChip(h).replace("m", "") : ""}
              </span>
            ))}
          </div>
        </div>
        {LANES.map((lane) => (
          <div className="matrix-row" key={lane}>
            <span className={clsx("lab", lane)}>{lane}</span>
            <div className="matrix-cells">
              {HOURS.map((h) => {
                const n = counts.get(`${lane}:${h}`) || 0;
                const pressed = hour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    className={clsx("cell", lane, n && "on", pressed && "selected")}
                    style={{ opacity: n ? 0.28 + (n / max) * 0.72 : undefined }}
                    aria-label={`${lane} ${prettyHourChip(h)}${n ? ` · ${n} looks` : " · empty"}`}
                    aria-pressed={pressed}
                    onClick={() => onHour(pressed ? null : h)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="empty">empty hours stay empty · phone is not on this grid</div>
    </section>
  );
}
