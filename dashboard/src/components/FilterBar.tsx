import type { ReactNode } from "react";
import clsx from "clsx";
import { CLASS_LABEL, CLASS_ORDER, bandOf, classifyApp } from "../lib/classify";
import { prettyApp, prettyHourChip } from "../lib/format";
import { occupiedHours } from "../lib/metrics";
import { sliceActive } from "../lib/filters";
import type { AppClass, Band, Sample, Slice } from "../lib/types";

type Props = {
  samples: Sample[];
  phoneApps: string[];
  slice: Slice;
  onChange: (next: Partial<Slice>) => void;
  onClear: () => void;
};

function Chip({
  label,
  pressed,
  onClick,
  tone,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button type="button" className={clsx("chip", tone)} aria-pressed={pressed} onClick={onClick}>
      {label}
    </button>
  );
}

function Row({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="rail-row">
      <span className="rail-k">{kicker}</span>
      <div className="rail-chips">{children}</div>
    </div>
  );
}

function visibleClasses(samples: Sample[], phoneApps: string[]): AppClass[] {
  const set = new Set<AppClass>();
  for (const s of samples) set.add(s.cls);
  for (const app of phoneApps) set.add(classifyApp(app));
  return CLASS_ORDER.filter((cls) => set.has(cls));
}

function bandHas(samples: Sample[], band: Exclude<Band, "all">): boolean {
  return samples.some((s) => bandOf(s.h) === band);
}

export function FilterBar({ samples, phoneApps, slice, onChange, onClear }: Props) {
  const hours = occupiedHours(samples);
  const apps = [...new Set([...samples.map((s) => s.app), ...phoneApps])].filter(Boolean);
  const classes = visibleClasses(samples, phoneApps);
  const bands = (["evening", "night", "morning", "afternoon"] as const).filter(
    (band) => bandHas(samples, band) || slice.band === band,
  );

  return (
    <div className="rail" role="toolbar" aria-label="slice">
      <Row kicker="class">
        <Chip label="all" pressed={slice.cls === "all"} onClick={() => onChange({ cls: "all" })} />
        {classes.map((cls) => (
          <Chip
            key={cls}
            label={CLASS_LABEL[cls]}
            pressed={slice.cls === cls}
            onClick={() => onChange({ cls: slice.cls === cls ? "all" : cls })}
          />
        ))}
      </Row>
      <Row kicker="hour">
        <Chip
          label="all"
          pressed={slice.hour == null && slice.band === "all"}
          onClick={() => onChange({ hour: null, band: "all" })}
        />
        {bands.map((band) => (
          <Chip
            key={band}
            label={band}
            pressed={slice.band === band && slice.hour == null}
            onClick={() => onChange({ band: slice.band === band ? "all" : band, hour: null })}
          />
        ))}
        {hours.map((hour) => (
          <Chip
            key={hour}
            label={prettyHourChip(hour)}
            pressed={slice.hour === hour}
            onClick={() => onChange({ hour: slice.hour === hour ? null : hour, band: "all" })}
          />
        ))}
      </Row>
      <Row kicker="app">
        <Chip label="all" pressed={slice.app == null} onClick={() => onChange({ app: null })} />
        {apps.map((app) => (
          <Chip
            key={app}
            label={prettyApp(app)}
            pressed={slice.app === app}
            onClick={() => onChange({ app: slice.app === app ? null : app })}
          />
        ))}
      </Row>
      <Row kicker="cut">
        <Chip
          label="both awake"
          pressed={slice.overlap}
          onClick={() => onChange({ overlap: !slice.overlap })}
        />
        {sliceActive(slice) ? (
          <Chip label="clear" pressed={false} onClick={onClear} tone="hot" />
        ) : null}
      </Row>
    </div>
  );
}
