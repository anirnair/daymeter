import { useEffect, useMemo, useState } from 'react'
import { computeMetrics } from './lib/dayMetrics'
import { MeterCard } from './components/MeterCard'
import './App.css'

function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

function App() {
  const now = useNow()
  const metrics = useMemo(() => computeMetrics(now), [now])

  return (
    <main className="app">
      <header className="app__header">
        <span className="app__brand">daymeter</span>
        <h1 className="app__clock">{timeFormatter.format(now)}</h1>
        <p className="app__date">{dateFormatter.format(now)}</p>
      </header>

      <section className="app__grid" aria-label="Time progress meters">
        {metrics.map((metric) => (
          <MeterCard key={metric.key} metric={metric} />
        ))}
      </section>

      <footer className="app__footer">
        <span>Every second counts — watch it tick.</span>
      </footer>
    </main>
  )
}

export default App
