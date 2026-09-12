import clsx from "clsx";
import { deviceLagLine, prettyLag } from "../lib/freshness";
import type { Freshness } from "../lib/types";

type Props = {
  freshness: Freshness;
};

export function FreshnessBar({ freshness }: Props) {
  const lagLabel = prettyLag(freshness.lastIngest || freshness.lastUpdated);
  const devices = deviceLagLine(freshness.devices);
  const live = freshness.source === "live";
  return (
    <div className="fresh" aria-label="data freshness">
      <span className={clsx("fresh-src", live && "on")}>{live ? "live" : "seed"}</span>
      <span className="foot-sep"> · </span>
      <span>{lagLabel}</span>
      {devices ? (
        <>
          <span className="foot-sep"> · </span>
          <span>{devices}</span>
        </>
      ) : null}
      {!freshness.writable && freshness.source === "seed" ? (
        <>
          <span className="foot-sep"> · </span>
          <span>collectors POST /api/ingest</span>
        </>
      ) : null}
    </div>
  );
}
