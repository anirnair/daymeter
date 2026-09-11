import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { splitDuration } from "../lib/format";

export function DurationHero({ minutes, label }: { minutes: number; label: string }) {
  const { hours, mins, underHour } = splitDuration(minutes);
  return (
    <div className="hero">
      <NumberFlowGroup>
        <div className="hero-num" aria-label={label}>
          {underHour ? (
            <>
              <NumberFlow value={mins} />
              <span className="hero-unit">min</span>
            </>
          ) : (
            <>
              <NumberFlow value={hours} />
              <span className="hero-unit">h</span>
              <NumberFlow value={mins} />
              <span className="hero-unit">m</span>
            </>
          )}
        </div>
      </NumberFlowGroup>
      <div className="hero-lab">screen time</div>
    </div>
  );
}
