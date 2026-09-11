import { useEffect, useMemo, useState } from "react";
import { DurationHero } from "./components/DurationHero";
import { DeviceSplit } from "./components/DeviceSplit";
import { DayStrip } from "./components/DayStrip";
import { ToolsChart } from "./components/ToolsChart";
import { PhoneBreakdown } from "./components/PhoneBreakdown";
import { HourChart } from "./components/HourChart";
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

  const viewSamples = useMemo(() => {
    if (!data) return [];
    let list = samplesFor(data, day);
    if (device !== "all" && device !== "phone") list = list.filter((s) => s.key === device);
    if (app) list = list.filter((s) => s.app === app);
    return list;
  }, [data, day, device, app]);

  const phone = useMemo(() => {
    if (!data) return null;
    const reports = phonesFor(data, day);
    if (device === "mac" || device === "msi") return null;
    return reports[0] ?? null;
  }, [data, day, device]);

  function shiftDay(delta: number) {
    const i = dayOrder.indexOf(day);
    if (i < 0) return;
    const next = dayOrder[i + delta];
    if (next) {
      setDay(next);
      setApp(null);
      setDevice("all");
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") shiftDay(-1);
      if (e.key === "ArrowRight") shiftDay(1);
      if (e.key === "Escape") {
        setApp(null);
        setDevice("all");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!data) {
    return (
      <div className="shell">
        <div className="brand">daymeter</div>
        <div className="empty">Loading the day…</div>
      </div>
    );
  }

  const macMin = deviceMinutes(viewSamples, "mac");
  const msiMin = deviceMinutes(viewSamples, "msi");
  const phoneMin = device === "mac" || device === "msi" ? 0 : phoneMinutes(phone);
  const total = macMin + msiMin + phoneMin;
  const shareTotal = Math.max(total, 0.001);
  const i = dayOrder.indexOf(day);
  const tools = appMinutes(viewSamples.filter((s) => device === "all" || s.key === device));
  const computerJumps = (["mac", "msi"] as const).map((key) => {
    const list = viewSamples.filter((s) => s.key === key);
    return { name: DEVICE_LABEL[key], jumps: Math.round(jumpsPerHour(list)), tone: key };
  });

  const macLooks = viewSamples.filter((s) => s.key === "mac").length;
  const msiLooks = viewSamples.filter((s) => s.key === "msi").length;
  const showPhoneSection = Boolean(phone && (device === "all" || device === "phone"));
  const showStrip = viewSamples.length > 0 && device !== "phone";
  const showTools = tools.length > 0 && device !== "phone";

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

      <DurationHero minutes={total} label={`${prettyDuration(total)} screen time`} />

      <div className="share" aria-hidden="true">
        {macMin > 0 && <i className="mac" style={{ width: `${(macMin / shareTotal) * 100}%` }} />}
        {msiMin > 0 && <i className="msi" style={{ width: `${(msiMin / shareTotal) * 100}%` }} />}
        {phoneMin > 0 && <i className="phone" style={{ width: `${(phoneMin / shareTotal) * 100}%` }} />}
      </div>

      <DeviceSplit
        selected={device}
        onSelect={setDevice}
        cards={[
          {
            key: "mac",
            minutes: macMin,
            available: macLooks > 0,
            meta: macLooks ? `${macLooks} look${macLooks === 1 ? "" : "s"}` : "no looks",
          },
          {
            key: "msi",
            minutes: msiMin,
            available: msiLooks > 0,
            meta: msiLooks ? `${msiLooks} look${msiLooks === 1 ? "" : "s"}` : "no looks",
          },
          {
            key: "phone",
            minutes: phoneMin,
            available: Boolean(phone),
            meta: phone?.switches != null ? `${phone.switches} jumps` : phone ? "reported" : "no report",
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
          <HourChart samples={viewSamples} />
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
