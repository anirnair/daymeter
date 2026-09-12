import clsx from "clsx";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { DEVICE_LABEL, prettyDuration } from "../lib/format";
import type { DeviceKey } from "../lib/types";

type Card = {
  key: DeviceKey;
  minutes: number;
  meta: string;
  available: boolean;
};

type Props = {
  cards: Card[];
  selected: DeviceKey | "all";
  onSelect: (key: DeviceKey | "all") => void;
};

export function DeviceSplit({ cards, selected, onSelect }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <LayoutGroup>
      <div className="devices">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={clsx("dev-card", card.key)}
            aria-pressed={selected === card.key}
            aria-label={`${DEVICE_LABEL[card.key]} ${prettyDuration(card.minutes)}`}
            disabled={!card.available}
            onClick={() => onSelect(selected === card.key ? "all" : card.key)}
          >
            {selected === card.key &&
              (reduceMotion ? (
                <span className="sel" />
              ) : (
                <motion.span
                  className="sel"
                  layoutId="device-sel"
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                />
              ))}
            <div className="kicker">{DEVICE_LABEL[card.key]}</div>
            <div className="time">{card.available ? prettyDuration(card.minutes) : "—"}</div>
            <div className="meta">{card.meta}</div>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
