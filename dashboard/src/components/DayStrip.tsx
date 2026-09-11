import clsx from "clsx";
import { FloatCard } from "./FloatCard";
import { DEVICE_LABEL, prettyDuration, prettyHourTick, prettyTime, prettyApp } from "../lib/format";
import { axisWindow, hourTicks, sampleIndexOnDevice } from "../lib/metrics";
import type { DeviceKey, Sample } from "../lib/types";

type Props = {
  samples: Sample[];
  deviceFilter: DeviceKey | "all";
  appFilter: string | null;
};

export function DayStrip({ samples, deviceFilter, appFilter }: Props) {
  const lanes: DeviceKey[] = ["mac", "msi"];
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
          <span key={t}>{prettyHourTick(t)}</span>
        ))}
      </div>
      {lanes.map((key) => {
        const marks = samples.filter((s) => s.key === key);
        return (
          <div className="lane" key={key}>
            <div className={clsx("lab", key)}>{DEVICE_LABEL[key]}</div>
            <div className="track">
              {marks.map((s) => {
                const left = ((s.h - start) / span) * 100;
                const dim =
                  (deviceFilter !== "all" && s.key !== deviceFilter) ||
                  (appFilter != null && s.app !== appFilter);
                const { index, total } = sampleIndexOnDevice(samples, s);
                return (
                  <FloatCard
                    key={s.id}
                    title={prettyApp(s.app)}
                    lines={[
                      `${DEVICE_LABEL[s.key]} · ${prettyTime(s.ts)}`,
                      `${prettyDuration(s.minutes)} on this stretch`,
                      `look ${index} of ${total} for this app`,
                    ]}
                  >
                    <div
                      className={clsx("mark", s.key, dim && "dimmed")}
                      style={{ left: `calc(${left}% - 5px)` }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${prettyApp(s.app)} on ${DEVICE_LABEL[s.key]} at ${prettyTime(s.ts)}, ${prettyDuration(s.minutes)}`}
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
