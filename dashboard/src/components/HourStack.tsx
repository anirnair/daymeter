import clsx from "clsx";
import { prettyDuration, prettyHourChip } from "../lib/format";
import type { ClockHour } from "../lib/clock";

type Props = {
  hours: ClockHour[];
  hour: number | null;
  onHour: (hour: number | null) => void;
};

export function HourStack({ hours, hour, onHour }: Props) {
  const max = Math.max(...hours.map((row) => row.mac + row.msi + row.phone), 1);
  const active = hours.filter((row) => row.minutes > 0);
  if (!active.length) return null;

  return (
    <section className="section">
      <h2>stacked hours</h2>
      <div className="hour-stack">
        {hours.map((row) => {
          const total = row.mac + row.msi + row.phone;
          const pressed = hour === row.hour;
          return (
            <button
              key={row.hour}
              type="button"
              className={clsx("hour-col", pressed && "on")}
              aria-label={`${prettyHourChip(row.hour)} ${prettyDuration(total)}`}
              aria-pressed={pressed}
              onClick={() => onHour(pressed ? null : row.hour)}
            >
              <span className="hour-bars">
                <i className="mac" style={{ height: `${(row.mac / max) * 100}%` }} />
                <i className="msi" style={{ height: `${(row.msi / max) * 100}%` }} />
                <i className="phone" style={{ height: `${(row.phone / max) * 100}%` }} />
              </span>
              {row.hour % 3 === 0 ? <span className="hour-lab">{prettyHourChip(row.hour).replace("m", "")}</span> : <span className="hour-lab" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
