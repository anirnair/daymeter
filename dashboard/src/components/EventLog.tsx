import { useState } from "react";
import clsx from "clsx";
import { CLASS_LABEL } from "../lib/classify";
import { DEVICE_LABEL, prettyApp, prettyClock, prettyDuration, dayKey } from "../lib/format";
import type { Sample } from "../lib/types";

type Props = {
  samples: Sample[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showDay: boolean;
};

export function EventLog({ samples, selectedId, onSelect, showDay }: Props) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const sorted = [...samples].sort((a, b) => a.ms - b.ms).filter((s) => {
    if (!needle) return true;
    const hay = `${prettyClock(s.ts)} ${dayKey(s.ts) ?? ""} ${DEVICE_LABEL[s.key]} ${CLASS_LABEL[s.cls]} ${prettyApp(s.app)} ${s.app} ${s.title ?? ""} ${s.url ?? ""} ${s.className ?? ""} ${s.bundle ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });

  return (
    <section className="section">
      <h2>looks</h2>
      <label className="find">
        <span>find</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="time, device, app, class"
          aria-label="find looks"
        />
      </label>
      {sorted.length === 0 ? (
        <div className="empty">{samples.length ? "No looks match that find." : "No looks in this slice."}</div>
      ) : (
        <div className="log" role="list">
          {sorted.map((s) => {
            const pressed = selectedId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={clsx("log-row", s.key, pressed && "selected")}
                role="listitem"
                aria-pressed={pressed}
                onClick={() => onSelect(pressed ? null : s.id)}
              >
                <span className="t">{prettyClock(s.ts)}</span>
                {showDay ? <span className="d">{dayKey(s.ts)?.slice(5)}</span> : null}
                <span className={clsx("dev", s.key)}>{DEVICE_LABEL[s.key]}</span>
                <span className="cls">{CLASS_LABEL[s.cls]}</span>
                <span className="name">
                  {prettyApp(s.app)}
                  {s.title ? ` · ${s.title}` : ""}
                  {s.url ? ` · ${s.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : ""}
                </span>
                <span className="n">{s.explicit ? prettyDuration(s.minutes) : `est ${prettyDuration(s.minutes)}`}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="empty">est. stretch is the gap to the next look on that machine, capped at 20 min · timed sessions keep their own seconds</div>
    </section>
  );
}
