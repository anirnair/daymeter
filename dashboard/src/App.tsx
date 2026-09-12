import { useEffect, useMemo, useRef, useState } from "react";
import { DurationHero } from "./components/DurationHero";
import { DeviceSplit } from "./components/DeviceSplit";
import { DayStrip } from "./components/DayStrip";
import { ToolsChart } from "./components/ToolsChart";
import { PhoneBreakdown } from "./components/PhoneBreakdown";
import { FilterBar } from "./components/FilterBar";
import { InsightBoard } from "./components/InsightBoard";
import { HourMatrix } from "./components/HourMatrix";
import { EventLog } from "./components/EventLog";
import { Inspector } from "./components/Inspector";
import { loadDaymeter } from "./lib/load";
import {
  DEVICE_LABEL,
  prettyDate,
  prettyDateRange,
  prettyDuration,
  prettyUpdated,
} from "./lib/format";
import {
  appMinutes,
  coincidences,
  deviceMinutes,
  jumpsPerHour,
  overlapHalfHours,
  phoneMinutes,
} from "./lib/metrics";
import { applyPhoneSlice, applySampleSlice, EMPTY_SLICE, matchSample, sliceActive } from "./lib/filters";
import { generateInsights } from "./lib/insights";
import type { DaymeterData, DeviceKey, PhoneReport, Sample, Slice } from "./lib/types";

function samplesFor(data: DaymeterData, day: string | "all"): Sample[] {
  if (day === "all") return data.samples;
  return data.samples.filter((s) => s.ts.startsWith(day));
}

function phonesFor(data: DaymeterData, day: string | "all"): PhoneReport[] {
  if (day === "all") return Object.values(data.phones);
  return data.phones[day] ? [data.phones[day]] : [];
}

function dateLabel(data: DaymeterData, day: string | "all"): string {
  if (day === "all") {
    if (!data.days.length) return "No days yet";
    return prettyDateRange(data.days);
  }
  return prettyDate(day);
}

export default function App() {
  const [data, setData] = useState<DaymeterData | null>(null);
  const [day, setDay] = useState<string | "all">("all");
  const [slice, setSlice] = useState<Slice>(EMPTY_SLICE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [animateHero, setAnimateHero] = useState(false);

  useEffect(() => {
    void loadDaymeter().then((loaded) => {
      setData(loaded);
      setDay(loaded.days.length > 1 ? "all" : loaded.days[0] ?? "all");
    });
  }, []);

  const dayOrder = useMemo(() => {
    if (!data) return ["all"] as const;
    return data.days.length > 1 ? (["all", ...data.days] as const) : data.days;
  }, [data]);

  const daySamples = useMemo(() => (data ? samplesFor(data, day) : []), [data, day]);
  const dayPhone = useMemo(() => {
    if (!data) return null;
    return phonesFor(data, day)[0] ?? null;
  }, [data, day]);

  const viewSamples = useMemo(() => applySampleSlice(daySamples, slice), [daySamples, slice]);
  const phone = useMemo(() => applyPhoneSlice(dayPhone, slice), [dayPhone, slice]);
  const both = useMemo(() => overlapHalfHours(daySamples), [daySamples]);
  const sameSecond = useMemo(() => coincidences(daySamples), [daySamples]);

  const computerMin = viewSamples.reduce((n, s) => n + s.minutes, 0);
  const dayMacMin = deviceMinutes(daySamples, "mac");
  const dayMsiMin = deviceMinutes(daySamples, "msi");
  const dayPhoneMin = phoneMinutes(dayPhone);
  const phoneMinSlice = phoneMinutes(phone);
  const total = computerMin + phoneMinSlice;

  const macMinSlice = viewSamples.filter((s) => s.key === "mac").reduce((n, s) => n + s.minutes, 0);
  const msiMinSlice = viewSamples.filter((s) => s.key === "msi").reduce((n, s) => n + s.minutes, 0);
  const shareTotal = Math.max(total, 0.001);

  const dayRef = useRef(day);
  const dayOrderRef = useRef(dayOrder);
  dayRef.current = day;
  dayOrderRef.current = dayOrder;

  function patchSlice(next: Partial<Slice>) {
    setAnimateHero(true);
    setSlice((cur) => ({ ...cur, ...next }));
  }

  function clearSlice() {
    setAnimateHero(false);
    setSlice(EMPTY_SLICE);
    setSelectedId(null);
  }

  function shiftDay(delta: number) {
    const order = dayOrderRef.current;
    const i = order.indexOf(dayRef.current);
    if (i < 0) return;
    const next = order[i + delta];
    if (next) {
      setAnimateHero(false);
      setDay(next);
      clearSlice();
    }
  }

  function selectDevice(key: DeviceKey | "all") {
    setAnimateHero(true);
    setSlice((cur) => ({ ...cur, device: key }));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") shiftDay(-1);
      if (e.key === "ArrowRight") shiftDay(1);
      if (e.key === "Escape") {
        setAnimateHero(false);
        setSlice(EMPTY_SLICE);
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!data) {
    return (
      <div className="shell">
        <div className="brand">daymeter</div>
        <div className="empty">Loading the day…</div>
      </div>
    );
  }

  const i = dayOrder.indexOf(day);
  const tools = appMinutes(viewSamples);
  const jumpSource = slice.device === "phone" ? daySamples : viewSamples;
  const computerJumps = (["mac", "msi"] as const).map((key) => {
    const list = jumpSource.filter((s) => s.key === key);
    return { name: DEVICE_LABEL[key], jumps: Math.round(jumpsPerHour(list)), tone: key } as const;
  });

  const macLooks = daySamples.filter((s) => s.key === "mac").length;
  const msiLooks = daySamples.filter((s) => s.key === "msi").length;
  const daysInView = day === "all" ? data.days : [day];
  const insights = generateInsights(daySamples, dayPhone, slice, daysInView);
  const selected = daySamples.find((s) => s.id === selectedId) ?? viewSamples.find((s) => s.id === selectedId) ?? null;
  const showPhoneSection = Boolean(phone);
  const showStrip = daySamples.some((s) => s.key === "mac" || s.key === "msi") && slice.device !== "phone";
  const showMatrix = showStrip;
  const showLog = slice.device !== "phone";
  const sliced = sliceActive(slice);

  return (
    <div className="shell">
      <div className="brand">daymeter</div>

      <div className="day-picker" aria-label="day">
        <button
          type="button"
          className="nav-btn"
          aria-label="Previous day"
          disabled={i <= 0}
          onClick={() => shiftDay(-1)}
        >
          ←
        </button>
        <div className="day">{dateLabel(data, day)}</div>
        <button
          type="button"
          className="nav-btn"
          aria-label="Next day"
          disabled={i < 0 || i >= dayOrder.length - 1}
          onClick={() => shiftDay(1)}
        >
          →
        </button>
      </div>

      <DurationHero
        minutes={total}
        label={`${prettyDuration(total)} screen time`}
        animated={animateHero}
      />
      {sliced ? (
        <div className="hero-lab">in this slice · {viewSamples.length} look{viewSamples.length === 1 ? "" : "s"}{phone ? " + phone" : ""}</div>
      ) : null}

      <div className="share" aria-hidden="true">
        <i className="mac" style={{ width: `${(macMinSlice / shareTotal) * 100}%` }} />
        <i className="msi" style={{ width: `${(msiMinSlice / shareTotal) * 100}%` }} />
        <i className="phone" style={{ width: `${(phoneMinSlice / shareTotal) * 100}%` }} />
      </div>

      <DeviceSplit
        selected={slice.device}
        onSelect={selectDevice}
        cards={[
          {
            key: "mac",
            minutes: dayMacMin,
            available: macLooks > 0,
            meta: macLooks ? `${macLooks} look${macLooks === 1 ? "" : "s"}` : "no looks",
          },
          {
            key: "msi",
            minutes: dayMsiMin,
            available: msiLooks > 0,
            meta: msiLooks ? `${msiLooks} look${msiLooks === 1 ? "" : "s"}` : "no looks",
          },
          {
            key: "phone",
            minutes: dayPhoneMin,
            available: Boolean(dayPhone),
            meta: dayPhone?.switches != null ? `${dayPhone.switches} jumps` : dayPhone ? "reported" : "no report",
          },
        ]}
      />

      <FilterBar
        samples={daySamples}
        phoneApps={dayPhone?.top ?? []}
        slice={slice}
        onChange={patchSlice}
        onClear={clearSlice}
      />

      {selected ? (
        <Inspector
          sample={selected}
          all={daySamples}
          onSlice={patchSlice}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      <InsightBoard rows={insights} onSlice={patchSlice} />

      {showStrip ? (
        <section className="section">
          <h2>across the day</h2>
          <DayStrip
            samples={daySamples}
            match={(s) => matchSample(s, slice, both)}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hour={slice.hour}
            onHour={(hour) => patchSlice({ hour, band: "all" })}
            coincidenceAt={sameSecond.map((hit) => hit.mac.h)}
          />
        </section>
      ) : null}

      {showMatrix ? (
        <HourMatrix
          samples={applySampleSlice(daySamples, { ...slice, hour: null, band: "all" })}
          hour={slice.hour}
          onHour={(hour) => patchSlice({ hour, band: "all" })}
        />
      ) : null}

      {tools.length > 0 ? (
        <section className="section">
          <h2>tools</h2>
          <ToolsChart
            rows={tools}
            selected={slice.app}
            onSelect={(app) => patchSlice({ app })}
            maxMinutes={tools[0]?.minutes ?? 1}
          />
        </section>
      ) : null}

      {showPhoneSection && phone ? (
        <section className="section">
          <h2>on phone</h2>
          <PhoneBreakdown
            phone={phone}
            computerJumps={computerJumps}
            selected={slice.app}
            onSelect={(app) => patchSlice({ app })}
          />
        </section>
      ) : null}

      {showLog ? (
        <EventLog
          samples={viewSamples}
          selectedId={selectedId}
          onSelect={setSelectedId}
          showDay={day === "all"}
        />
      ) : null}

      {!showStrip && !showPhoneSection && !viewSamples.length ? (
        <div className="empty">Nothing on this day yet.</div>
      ) : null}

      {data.lastUpdated ? (
        <div className="foot">
          Updated {prettyUpdated(data.lastUpdated)}
          <span className="foot-sep"> · </span>
          hard marks are real samples · phone is reported · blanks are missing polls
        </div>
      ) : null}
    </div>
  );
}
