import { CLASS_LABEL } from "../lib/classify";
import { DEVICE_LABEL, prettyApp, prettyClock, prettyDuration, prettyTime } from "../lib/format";
import { coincidences, sampleIndexOnDevice } from "../lib/metrics";
import type { Sample, Slice } from "../lib/types";

type Props = {
  sample: Sample;
  all: Sample[];
  onSlice: (next: Partial<Slice>) => void;
  onClose: () => void;
};

export function Inspector({ sample, all, onSlice, onClose }: Props) {
  const { index, total } = sampleIndexOnDevice(all, sample);
  const same = coincidences(all).find((hit) => hit.mac.id === sample.id || hit.msi.id === sample.id);
  const other = same ? (sample.key === "mac" ? same.msi : same.mac) : null;

  return (
    <section className="inspector" aria-label="selected look">
      <div className="inspector-top">
        <div className="kicker">selected look</div>
        <button type="button" className="chip" onClick={onClose}>
          close
        </button>
      </div>
      <div className="inspector-title">
        {prettyApp(sample.app)} · {DEVICE_LABEL[sample.key]} · {prettyTime(sample.ts)}
      </div>
      <div className="inspector-detail">
        {prettyClock(sample.ts)} · {CLASS_LABEL[sample.cls]} · est {prettyDuration(sample.minutes)} · look {index} of {total} for this app
        {other
          ? ` · same second as ${prettyApp(other.app)} on ${DEVICE_LABEL[other.key]}`
          : ""}
        . Tabs / URLs not collected.
      </div>
      <div className="rail-chips">
        <button type="button" className="chip" aria-label="this hour" onClick={() => onSlice({ hour: Math.floor(sample.h), band: "all" })}>
          this hour
        </button>
        <button type="button" className="chip" aria-label="this app" onClick={() => onSlice({ app: sample.app })}>
          this app
        </button>
        <button type="button" className="chip" aria-label="this device" onClick={() => onSlice({ device: sample.key })}>
          this device
        </button>
        <button type="button" className="chip" aria-label={CLASS_LABEL[sample.cls]} onClick={() => onSlice({ cls: sample.cls })}>
          {CLASS_LABEL[sample.cls]}
        </button>
      </div>
    </section>
  );
}
