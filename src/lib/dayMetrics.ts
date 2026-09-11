export interface Metric {
  key: string
  label: string
  /** Fraction elapsed in the range [0, 1]. */
  fraction: number
  /** Human-readable remaining-time description, e.g. "5h 12m left". */
  remainingLabel: string
}

const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

/** Clamp a number into the inclusive [min, max] range. */
export function clamp(value: number, min = 0, max = 1): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * Format a positive duration (in ms) into a compact "left" label using the two
 * most significant non-zero units, e.g. "5h 12m left" or "43s left".
 */
export function formatRemaining(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms))
  if (clamped < MS_PER_SECOND) return 'complete'

  const days = Math.floor(clamped / MS_PER_DAY)
  const hours = Math.floor((clamped % MS_PER_DAY) / MS_PER_HOUR)
  const minutes = Math.floor((clamped % MS_PER_HOUR) / MS_PER_MINUTE)
  const seconds = Math.floor((clamped % MS_PER_MINUTE) / MS_PER_SECOND)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)

  return `${parts.slice(0, 2).join(' ')} left`
}

function fractionElapsed(start: number, end: number, now: number): number {
  return clamp((now - start) / (end - start))
}

/** Compute the elapsed-day/week/month/year metrics for a given instant. */
export function computeMetrics(now: Date = new Date()): Metric[] {
  const t = now.getTime()

  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  // Week starts on Monday.
  const weekStart = new Date(dayStart)
  const isoDay = (now.getDay() + 6) % 7 // Mon = 0 ... Sun = 6
  weekStart.setDate(weekStart.getDate() - isoDay)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1)

  const ranges: Array<{ key: string; label: string; start: Date; end: Date }> = [
    { key: 'day', label: 'Day', start: dayStart, end: dayEnd },
    { key: 'week', label: 'Week', start: weekStart, end: weekEnd },
    { key: 'month', label: 'Month', start: monthStart, end: monthEnd },
    { key: 'year', label: 'Year', start: yearStart, end: yearEnd },
  ]

  return ranges.map(({ key, label, start, end }) => {
    const fraction = fractionElapsed(start.getTime(), end.getTime(), t)
    return {
      key,
      label,
      fraction,
      remainingLabel: formatRemaining(end.getTime() - t),
    }
  })
}
