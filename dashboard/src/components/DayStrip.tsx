import clsx from "clsx";
import { FloatCard } from "./FloatCard";
import { DEVICE_LABEL, prettyDuration, prettyHourTick, prettyTime, prettyApp, prettyClock } from "../lib/format";
import { CLASS_LABEL } from "../lib/classify";
import { axisWindow, hourTicks, sampleIndexOnDevice } from "../lib/metrics";
import type { DeviceKey, Sample } from "../lib/types";

type Props = {
  samples: Sample[];
  match: (s: Sample) => boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hour: number | null;
  onHour: (hour: number | null) => void;
  coincidenceAt: number[];
};

export function DayStrip({
  samples,
  match,
  selectedId,
  onSelect,
  hour,
  onHour,
  coincidenceAt,
}: Props) {
  const lanes: DeviceKey[] = ["mac", "msi", "phone"];
  if (!samples.length) {
    return <div className="empty">No looks on this day.</div>;
  }

  const { start, end } = axisWindow(samples);
  const span = Math.max(end - start, 1);
  const ticks = hourTicks(start, end);

  return (
    <div className="strip">
      <div className="ticks">
        {ticks.map((t) => (
          <button
            key={t}
            type="button"
            className={clsx("tick", hour === t && "on")}
            onClick={() => onHour(hour === t ? null : t)}
          >
            {prettyHourTick(t)}
          </button>
        ))}
      </div>
      {lanes
        .filter((key) => samples.some((s) => s.key === key))
        .map((key) => {
          const marks = samples.filter((s) => s.key === key);
          return (
            <div className="lane" key={key}>
              <div className={clsx("lab", key)}>{DEVICE_LABEL[key]}</div>
              <div className="track">
                {coincidenceAt.map((h) => (
                  <i
                    key={h}
                    className="coin"
                    style={{ left: `${((h - start) / span) * 100}%` }}
                    aria-hidden="true"
                  />
                ))}
                {marks.map((s) => {
                  const left = ((s.h - start) / span) * 100;
                  const dim = !match(s);
                  const sel = selectedId === s.id;
                  const { index, total } = sampleIndexOnDevice(samples, s);
                  return (
                    <FloatCard
                      key={s.id}
                      side="bottom"
                      title={prettyApp(s.app)}
                      lines={[
                        `${DEVICE_LABEL[s.key]} · ${prettyTime(s.ts)} · ${prettyClock(s.ts)}`,
                        `${CLASS_LABEL[s.cls]} · ${prettyDuration(s.minutes)} ${s.explicit ? "timed" : "on this stretch"}`,
                        s.title || s.url || s.bundle || `look ${index} of ${total} for this app`,
                      ]}
                    >
                      <button
                        type="button"
                        className={clsx("mark", s.key, dim && "dimmed", sel && "selected")}
                        style={{ left: `calc(${left}% - 5px)` }}
                        aria-label={`${prettyApp(s.app)} on ${DEVICE_LABEL[s.key]} at ${prettyClock(s.ts)}, ${prettyDuration(s.minutes)}`}
                        aria-pressed={sel}
                        onClick={() => onSelect(sel ? null : s.id)}
                      />
                    </FloatCard>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
