import { clockHours, unclockedPhoneMinutes } from "../lib/clock";
import { prettyDate } from "../lib/format";
import { deviceMinutes, phoneMinutes } from "../lib/metrics";
import type { PhoneReport, Sample } from "../lib/types";
import { DayClock } from "./DayClock";

type Props = {
  days: string[];
  samples: Sample[];
  phones?: Record<string, PhoneReport>;
  selected: string | "all";
  hour: number | null;
  onDay: (day: string) => void;
};

export function ClockStrip({ days, samples, phones = {}, selected, hour, onDay }: Props) {
  if (days.length < 2) return null;
  return (
    <section className="section">
      <h2>days as clocks</h2>
      <div className="clock-strip">
        {days.map((day) => {
          const daySamples = samples.filter((s) => s.ts.startsWith(day));
          const hours = clockHours(daySamples);
          const phone = phones[day] ?? null;
          const pressed = selected === day;
          const mac = deviceMinutes(daySamples, "mac");
          const msi = deviceMinutes(daySamples, "msi");
          const phoneMin = Math.max(deviceMinutes(daySamples, "phone"), phoneMinutes(phone));
          return (
            <button
              key={day}
              type="button"
              className={pressed ? "clock-day on" : "clock-day"}
              aria-pressed={pressed}
              onClick={() => onDay(day)}
            >
              <DayClock
                hours={hours}
                hour={pressed ? hour : null}
                onHour={() => onDay(day)}
                size={132}
                compact
                label={prettyDate(day)}
                unclockedPhone={unclockedPhoneMinutes(daySamples, phone)}
                dayMinutes={{ mac, msi, phone: phoneMin }}
              />
              <span className="clock-day-lab">{prettyDate(day).replace(/ 20\d\d$/, "")}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
