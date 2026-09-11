import { useEffect, useMemo, useRef, useState } from "react";
import { DurationHero } from "./components/DurationHero";
import { DeviceSplit } from "./components/DeviceSplit";
import { DayStrip } from "./components/DayStrip";
import { ToolsChart } from "./components/ToolsChart";
import { PhoneBreakdown } from "./components/PhoneBreakdown";
import { loadDaymeter } from "./lib/load";
import {
  DEVICE_LABEL,
  prettyDate,
  prettyDateRange,
  prettyDuration,
  prettyUpdated,
} from "./lib/format";
import { appMinutes, deviceMinutes, jumpsPerHour, phoneMinutes } from "./lib/metrics";
import type { DaymeterData, DeviceKey, PhoneReport, Sample } from "./lib/types";

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
  const [device, setDevice] = useState<DeviceKey | "all">("all");
  const [app, setApp] = useState<string | null>(null);
  const skipTicker = useRef(true);

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

  const viewSamples = useMemo(() => {
    let list = daySamples;
    if (device === "phone") list = [];
    else if (device !== "all") list = list.filter((s) => s.key === device);
    if (app) list = list.filter((s) => s.app === app);
    return list;
  }, [daySamples, device, app]);

  const phone = device === "mac" || device === "msi" ? null : dayPhone;

  const dayMacMin = deviceMinutes(daySamples, "mac");
  const dayMsiMin = deviceMinutes(daySamples, "msi");
  const dayPhoneMin = phoneMinutes(dayPhone);
  const total =
    device === "mac" ? dayMacMin : device === "msi" ? dayMsiMin : device === "phone" ? dayPhoneMin : dayMacMin + dayMsiMin + dayPhoneMin;

  const dayRef = useRef(day);
  const dayOrderRef = useRef(dayOrder);
  dayRef.current = day;
  dayOrderRef.current = dayOrder;

  function shiftDay(delta: number) {
    const order = dayOrderRef.current;
    const i = order.indexOf(dayRef.current);
    if (i < 0) return;
    const next = order[i + delta];
    if (next) {
      skipTicker.current = true;
      setDay(next);
      setApp(null);
      setDevice("all");
    }
  }

  function selectDevice(key: DeviceKey | "all") {
    skipTicker.current = false;
    setDevice(key);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") shiftDay(-1);
      if (e.key === "ArrowRight") shiftDay(1);
      if (e.key === "Escape") {
        skipTicker.current = false;
        setApp(null);
        setDevice("all");
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

  const macMinSlice = device === "all" || device === "mac" ? dayMacMin : 0;
  const msiMinSlice = device === "all" || device === "msi" ? dayMsiMin : 0;
  const phoneMinSlice = device === "all" || device === "phone" ? dayPhoneMin : 0;
  const shareTotal = Math.max(total, 0.001);
  const i = dayOrder.indexOf(day);
  const tools = appMinutes(viewSamples);
  const jumpSource = device === "phone" ? daySamples : viewSamples;
  const computerJumps = (["mac", "msi"] as const).map((key) => {
    const list = jumpSource.filter((s) => s.key === key);
    return { name: DEVICE_LABEL[key], jumps: Math.round(jumpsPerHour(list)), tone: key } as const;
  });

  const macLooks = daySamples.filter((s) => s.key === "mac").length;
  const msiLooks = daySamples.filter((s) => s.key === "msi").length;
  const showPhoneSection = Boolean(phone && (device === "all" || device === "phone"));
  const showStrip = viewSamples.length > 0;
  const showTools = tools.length > 0;

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
        animated={!skipTicker.current}
      />

      <div className="share" aria-hidden="true">
        <i className="mac" style={{ width: `${(macMinSlice / shareTotal) * 100}%` }} />
        <i className="msi" style={{ width: `${(msiMinSlice / shareTotal) * 100}%` }} />
        <i className="phone" style={{ width: `${(phoneMinSlice / shareTotal) * 100}%` }} />
      </div>

      <DeviceSplit
        selected={device}
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

      {showStrip && (
        <section className="section">
          <h2>across the day</h2>
          <DayStrip
            samples={viewSamples}
            deviceFilter={device}
            appFilter={app}
          />
        </section>
      )}

      {showTools && (
        <section className="section">
          <h2>tools</h2>
          <ToolsChart
            rows={tools}
            selected={app}
            onSelect={setApp}
            maxMinutes={tools[0]?.minutes ?? 1}
          />
        </section>
      )}

      {showPhoneSection && phone && (
        <section className="section">
          <h2>on phone</h2>
          <PhoneBreakdown phone={phone} computerJumps={computerJumps} />
        </section>
      )}

      {!showStrip && !showPhoneSection && (
        <div className="empty">Nothing on this day yet.</div>
      )}

      {data.lastUpdated && (
        <div className="foot">Updated {prettyUpdated(data.lastUpdated)}</div>
      )}
    </div>
  );
}
