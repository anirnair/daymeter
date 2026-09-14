import clsx from "clsx";
import { deviceLagParts, prettyLag } from "../lib/freshness";
import type { Freshness } from "../lib/types";

type Props = {
  freshness: Freshness;
};

export function FreshnessBar({ freshness }: Props) {
  const lagLabel = prettyLag(freshness.lastIngest || freshness.lastUpdated);
  const devices = deviceLagParts(freshness.devices);
  const live = freshness.source === "live" || freshness.source === "origin";
  const note =
    freshness.source === "origin"
      ? "Writer via Origin"
      : !freshness.writable && freshness.source === "seed"
        ? "collectors POST /api/ingest"
        : null;
  return (
    <div className="fresh" aria-label="data freshness">
      <span className={clsx("fresh-item", "fresh-src", live && "on")}>
        {freshness.source === "live" ? "live" : freshness.source === "origin" ? "origin" : "seed"}
      </span>
      <span className="fresh-item">{lagLabel}</span>
      {devices.map((part) => (
        <span className="fresh-item" key={part.key}>
          {part.label} {part.lag}
        </span>
      ))}
      {note ? <span className="fresh-item">{note}</span> : null}
    </div>
  );
}
