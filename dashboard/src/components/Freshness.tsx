import clsx from "clsx";
import { useEffect, useState } from "react";
import { freshnessParts } from "../lib/freshness";
import type { Freshness } from "../lib/types";

type Props = {
  freshness: Freshness;
  now?: number;
};

export function FreshnessBar({ freshness, now: nowProp }: Props) {
  const [now, setNow] = useState(() => nowProp ?? Date.now());

  useEffect(() => {
    if (nowProp != null) {
      setNow(nowProp);
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [nowProp]);

  const parts = freshnessParts(freshness, now);
  const live = freshness.source === "live" || freshness.source === "origin";

  return (
    <div className="fresh" aria-label="data freshness">
      {parts.map((part) => (
        <span
          key={part.key}
          className={clsx("fresh-item", part.key === "source" && "fresh-src", part.key === "source" && live && "on")}
        >
          {part.text}
        </span>
      ))}
    </div>
  );
}
