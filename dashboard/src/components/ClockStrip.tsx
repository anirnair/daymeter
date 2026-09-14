import { clockHours } from "../lib/clock";
import { prettyDate } from "../lib/format";
import type { Sample } from "../lib/types";
import { DayClock } from "./DayClock";

type Props = {
  days: string[];
  samples: Sample[];
  selected: string | "all";
  hour: number | null;
  onDay: (day: string) => void;
};

export function ClockStrip({ days, samples, selected, hour, onDay }: Props) {
  if (days.length < 2) return null;
  return (
    <section className="section">
      <h2>days as clocks</h2>
      <div className="clock-strip">
        {days.map((day) => {
          const hours = clockHours(samples.filter((s) => s.ts.startsWith(day)));
          const pressed = selected === day;
          return (
            <button
              key={day}
              type="button"
              className={pressed ? "clock-day on" : "clock-day"}
              aria-pressed={pressed}
              onClick={() => onDay(day)}
            >
              <DayClock hours={hours} hour={pressed ? hour : null} onHour={() => onDay(day)} size={132} compact label={prettyDate(day)} />
              <span className="clock-day-lab">{prettyDate(day).replace(/ 20\d\d$/, "")}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
