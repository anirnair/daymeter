import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { splitDuration } from "../lib/format";

type Props = {
  minutes: number;
  label: string;
  animated?: boolean;
};

export function DurationHero({ minutes, label, animated = true }: Props) {
  const { hours, mins, underHour } = splitDuration(minutes);
  return (
    <div className="hero">
      <NumberFlowGroup>
        <div className="hero-num" aria-label={label} key={underHour ? "min" : "hm"}>
          {underHour ? (
            <>
              <NumberFlow value={mins} isolate animated={animated} />
              <span className="hero-unit">min</span>
            </>
          ) : (
            <>
              <NumberFlow value={hours} isolate animated={animated} />
              <span className="hero-unit">h</span>
              <NumberFlow value={mins} isolate animated={animated} />
              <span className="hero-unit">m</span>
            </>
          )}
        </div>
      </NumberFlowGroup>
      <div className="hero-lab">screen time</div>
    </div>
  );
}
