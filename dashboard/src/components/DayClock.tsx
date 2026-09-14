import clsx from "clsx";
import { dayShare, type ClockHour } from "../lib/clock";
import { DEVICE_LABEL, prettyDuration, prettyHourChip } from "../lib/format";
import type { DeviceKey } from "../lib/types";

type Props = {
  hours: ClockHour[];
  hour: number | null;
  onHour: (hour: number | null) => void;
  size?: number;
  label?: string;
  unclockedPhone?: number;
  dayMinutes?: { mac: number; msi: number; phone: number };
  compact?: boolean;
};

const RINGS: { key: DeviceKey; outer: number; inner: number }[] = [
  { key: "mac", outer: 108, inner: 90 },
  { key: "msi", outer: 86, inner: 68 },
  { key: "phone", outer: 64, inner: 46 },
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedge(cx: number, cy: number, outer: number, inner: number, hour: number) {
  const gap = 0.7;
  const start = -90 + hour * 15 + gap;
  const end = -90 + (hour + 1) * 15 - gap;
  const large = end - start > 180 ? 1 : 0;
  const a0 = polar(cx, cy, outer, start);
  const a1 = polar(cx, cy, outer, end);
  const b0 = polar(cx, cy, inner, start);
  const b1 = polar(cx, cy, inner, end);
  return `M ${a0.x} ${a0.y} A ${outer} ${outer} 0 ${large} 1 ${a1.x} ${a1.y} L ${b1.x} ${b1.y} A ${inner} ${inner} 0 ${large} 0 ${b0.x} ${b0.y} Z`;
}

function minutesFor(row: ClockHour, key: DeviceKey): number {
  if (key === "mac") return row.mac;
  if (key === "msi") return row.msi;
  return row.phone;
}

export function DayClock({
  hours,
  hour,
  onHour,
  size = 264,
  label,
  unclockedPhone = 0,
  dayMinutes,
  compact = false,
}: Props) {
  const cx = 120;
  const cy = 120;
  const fills = [
    { key: "mac" as const, r: 109, minutes: dayMinutes?.mac ?? hours.reduce((n, row) => n + row.mac, 0) },
    { key: "msi" as const, r: 87, minutes: dayMinutes?.msi ?? hours.reduce((n, row) => n + row.msi, 0) },
    {
      key: "phone" as const,
      r: 55,
      minutes: dayMinutes?.phone ?? hours.reduce((n, row) => n + row.phone, 0) + unclockedPhone,
    },
  ];
  const occupied = hours.some((row) => row.minutes > 0) || fills.some((ring) => ring.minutes > 0);

  return (
    <div className={clsx("clock", compact && "compact")}>
      <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label={label || "24 hour device clock"}>
        <circle cx={cx} cy={cy} r={110} fill="none" stroke="rgba(255,255,255,0.06)" />
        {fills.map((ring) => {
          const share = dayShare(ring.minutes);
          const c = 2 * Math.PI * ring.r;
          return (
            <circle
              key={`fill-${ring.key}`}
              cx={cx}
              cy={cy}
              r={ring.r}
              className={clsx("clock-fill", ring.key)}
              strokeDasharray={`${Math.max(0.01, share * c)} ${c}`}
              strokeDashoffset={c * 0.25}
              opacity={share > 0 ? 0.95 : 0.18}
            />
          );
        })}
        {[0, 6, 12, 18].map((tick) => {
          const p = polar(cx, cy, 116, -90 + tick * 15);
          return (
            <text key={tick} x={p.x} y={p.y} className="clock-tick" textAnchor="middle" dominantBaseline="middle">
              {tick === 0 ? "12" : String(tick)}
            </text>
          );
        })}
        {RINGS.map((ring) =>
          hours.map((row) => {
            const mins = minutesFor(row, ring.key);
            const selected = hour === row.hour;
            const opacity = mins <= 0 ? 0.06 : 0.22 + (Math.min(mins, 60) / 60) * 0.78;
            return (
              <path
                key={`${ring.key}-${row.hour}`}
                d={wedge(cx, cy, ring.outer, ring.inner, row.hour)}
                className={clsx("clock-seg", ring.key, selected && "on")}
                style={{ fillOpacity: mins <= 0 ? 0.06 : opacity }}
              />
            );
          }),
        )}
        {hours.map((row) => (
          <path
            key={`hit-${row.hour}`}
            d={wedge(cx, cy, 110, 44, row.hour)}
            className="clock-hit"
            role="button"
            tabIndex={0}
            aria-label={`${prettyHourChip(row.hour)} · Mac ${prettyDuration(row.mac)} · MSI ${prettyDuration(row.msi)} · Phone ${prettyDuration(row.phone)}`}
            onClick={() => onHour(hour === row.hour ? null : row.hour)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onHour(hour === row.hour ? null : row.hour);
              }
            }}
          />
        ))}
        <text x={cx} y={cy - 8} className="clock-center" textAnchor="middle">
          {hour != null ? prettyHourChip(hour) : occupied ? "24h" : "—"}
        </text>
        <text x={cx} y={cy + 10} className="clock-sub" textAnchor="middle">
          {hour != null
            ? prettyDuration((hours[hour]?.minutes ?? 0))
            : compact
              ? prettyDuration(fills[2].minutes || fills[0].minutes + fills[1].minutes)
              : "tap an hour"}
        </text>
      </svg>
      {!compact ? (
        <div className="clock-key">
          {RINGS.map((ring) => (
            <span key={ring.key} className={clsx("lab", ring.key)}>
              {DEVICE_LABEL[ring.key]}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
