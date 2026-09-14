import { useEffect, useMemo, useRef, useState } from "react";
import { DurationHero } from "./components/DurationHero";
import { DeviceSplit } from "./components/DeviceSplit";
import { DayStrip } from "./components/DayStrip";
import { ToolsChart } from "./components/ToolsChart";
import { PhoneBreakdown } from "./components/PhoneBreakdown";
import { FilterBar } from "./components/FilterBar";
import { InsightBoard } from "./components/InsightBoard";
import { BehaviorBoard } from "./components/BehaviorBoard";
import { HourMatrix } from "./components/HourMatrix";
import { EventLog } from "./components/EventLog";
import { Inspector } from "./components/Inspector";
import { FreshnessBar } from "./components/Freshness";
import { DayClock } from "./components/DayClock";
import { ClockStrip } from "./components/ClockStrip";
import { IntentMix } from "./components/IntentMix";
import { Simultaneous } from "./components/Simultaneous";
import { Landings } from "./components/Landings";
import { HourStack } from "./components/HourStack";
import { loadDaymeter } from "./lib/load";
import { generateBehavior } from "./lib/behavior";
import {
  clockHours,
  intentMinutes,
  landings,
  overlapStats,
  unclockedPhoneMinutes,
} from "./lib/clock";
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

function combinePhones(phones: PhoneReport[]): PhoneReport | null {
  if (!phones.length) return null;
  if (phones.length === 1) return phones[0];
  const top: string[] = [];
  const seen = new Set<string>();
  let switches = 0;
  let hours = 0;
  let sampled = false;
  for (const phone of phones) {
    hours += phone.hours;
    if (phone.switches) switches += phone.switches;
    if (phone.sampled) sampled = true;
    for (const app of phone.top) {
      if (seen.has(app)) continue;
      seen.add(app);
      top.push(app);
    }
  }
  return { day: phones.map((p) => p.day).sort().join(","), hours, top, switches: switches || null, sampled };
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
  const booted = useRef(false);

  useEffect(() => {
    let stop = false;
    async function tick() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const loaded = await loadDaymeter();
        if (stop) return;
        setData(loaded);
        if (!booted.current) {
          booted.current = true;
          setDay(loaded.days.length > 1 ? "all" : loaded.days[0] ?? "all");
        }
      } catch (err) {
        console.error(err);
      }
    }
    void tick();
    const id = window.setInterval(tick, 90_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  const dayOrder = useMemo(() => {
    if (!data) return ["all"] as const;
    return data.days.length > 1 ? (["all", ...data.days] as const) : data.days;
  }, [data]);

  const daySamples = useMemo(() => (data ? samplesFor(data, day) : []), [data, day]);
  const dayPhone = useMemo(() => {
    if (!data) return null;
    return combinePhones(phonesFor(data, day));
  }, [data, day]);

  const viewSamples = useMemo(() => applySampleSlice(daySamples, slice), [daySamples, slice]);
  const phone = useMemo(() => applyPhoneSlice(dayPhone, slice), [dayPhone, slice]);
  const both = useMemo(() => overlapHalfHours(daySamples), [daySamples]);
  const sameSecond = useMemo(() => coincidences(daySamples), [daySamples]);
  const clock = useMemo(() => clockHours(viewSamples), [viewSamples]);
  const overlap = useMemo(() => overlapStats(viewSamples), [viewSamples]);
  const intents = useMemo(() => intentMinutes(viewSamples, phone), [viewSamples, phone]);
  const landingRows = useMemo(() => landings(viewSamples), [viewSamples]);
  const unclocked = unclockedPhoneMinutes(daySamples, dayPhone);

  const phoneLooks = viewSamples.filter((s) => s.key === "phone");
  const computerView = viewSamples.filter((s) => s.key !== "phone");
  const computerMin = computerView.reduce((n, s) => n + s.minutes, 0);
  const dayMacMin = deviceMinutes(daySamples, "mac");
  const dayMsiMin = deviceMinutes(daySamples, "msi");
  const dayPhoneMin = Math.max(deviceMinutes(daySamples, "phone"), phoneMinutes(dayPhone));
  const phoneMinSlice = Math.max(
    phoneLooks.reduce((n, s) => n + s.minutes, 0),
    phoneMinutes(phone),
  );
  const total = computerMin + phoneMinSlice;

  const macMinSlice = viewSamples.filter((s) => s.key === "mac").reduce((n, s) => n + s.minutes, 0);
  const msiMinSlice = viewSamples.filter((s) => s.key === "msi").reduce((n, s) => n + s.minutes, 0);
  const shareTotal = Math.max(total, 0.001);

  const dayRef = useRef(day);
  const dayOrderRef = useRef(dayOrder);
  dayRef.current = day;
  dayOrderRef.current = dayOrder;

  function patchSlice(next: Partial<Slice>) {
    setAnimateHero(false);
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
    setAnimateHero(false);
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
  const phoneSessionLooks = daySamples.filter((s) => s.key === "phone").length;
  const daysInView = day === "all" ? data.days : [day];
  const insights = generateInsights(daySamples, dayPhone, slice, daysInView);
  const behavior = generateBehavior(daySamples, dayPhone, slice, daysInView);
  const selected = daySamples.find((s) => s.id === selectedId) ?? viewSamples.find((s) => s.id === selectedId) ?? null;
  const showPhoneSection = Boolean(phone);
  const timedLooks = daySamples.filter((s) => slice.device === "all" || s.key === slice.device);
  const showStrip = timedLooks.length > 0;
  const matrixSamples = applySampleSlice(daySamples, { ...slice, hour: null, band: "all" });
  const showMatrix = matrixSamples.length > 0;
  const showLog = timedLooks.length > 0;
  const sliced = sliceActive(slice);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">daymeter</div>
        <FreshnessBar freshness={data.freshness} />
      </header>

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
      ) : (
        <div className="hero-lab">how the day actually sat</div>
      )}

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
            available: Boolean(dayPhone) || phoneSessionLooks > 0,
            meta: phoneSessionLooks
              ? `${phoneSessionLooks} session${phoneSessionLooks === 1 ? "" : "s"}`
              : dayPhone?.switches != null
                ? `${dayPhone.switches} jumps`
                : dayPhone
                  ? "reported"
                  : "no report",
          },
        ]}
      />

      <FilterBar
        samples={daySamples}
        phoneApps={dayPhone?.top ?? []}
        slice={slice}
        onChange={patchSlice}
        onClear={clearSlice}
        canOverlap={both.size > 0 || overlap.dual > 0}
      />

      {selected ? (
        <Inspector
          sample={selected}
          all={daySamples}
          onSlice={patchSlice}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      <div className="dash">
        <section className="section clock-panel">
          <h2>24h clock</h2>
          <DayClock
            hours={clock}
            hour={slice.hour}
            onHour={(hour) => patchSlice({ hour, band: "all" })}
            unclockedPhone={unclocked}
            label="concentric 24 hour rings for Mac, MSI, and Phone"
          />
          <div className="empty">
            outer Mac · middle MSI · inner Phone · 12 at the top · tap an hour to slice
            {unclocked > 0
              ? ` · ${prettyDuration(unclocked)} phone time is reported but has no session clocks yet`
              : ""}
          </div>
        </section>
        <div className="dash-side">
          <Simultaneous stats={overlap} onSlice={patchSlice} />
          <IntentMix
            rows={intents}
            selected={slice.intent}
            onSelect={(intent) => patchSlice({ intent })}
          />
        </div>
      </div>

      <ClockStrip
        days={data.days}
        samples={data.samples}
        selected={day}
        hour={slice.hour}
        onDay={(next) => {
          setAnimateHero(false);
          setDay(next);
          clearSlice();
        }}
      />

      <HourStack hours={clock} hour={slice.hour} onHour={(hour) => patchSlice({ hour, band: "all" })} />

      <div className="dash">
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
        ) : (
          <div />
        )}
        <Landings rows={landingRows} selected={slice.app} onSelect={(app) => patchSlice({ app })} />
      </div>

      <InsightBoard rows={insights} onSlice={patchSlice} />
      <BehaviorBoard notes={behavior} onSlice={patchSlice} />

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
          samples={matrixSamples}
          hour={slice.hour}
          onHour={(hour) => patchSlice({ hour, band: "all" })}
        />
      ) : null}

      {showPhoneSection && phone ? (
        <section className="section">
          <h2>on phone</h2>
          <PhoneBreakdown
            phone={phone}
            computerJumps={computerJumps}
            selected={slice.app}
            onSelect={(app) => patchSlice({ app })}
            sampledMinutes={phoneLooks.length ? appMinutes(phoneLooks) : []}
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
          {data.freshness.source === "live"
            ? "live store + seed"
            : data.freshness.source === "origin"
              ? "Origin pull + seed"
              : "seed copy"}
          <span className="foot-sep"> · </span>
          refresh ~90s while this tab is open · phone needs timed sessions to sit on the inner ring
        </div>
      ) : null}
    </div>
  );
}
