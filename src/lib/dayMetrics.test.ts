import { describe, expect, it } from 'vitest'
import { clamp, computeMetrics, formatRemaining } from './dayMetrics'

describe('clamp', () => {
  it('keeps values within range', () => {
    expect(clamp(0.5)).toBe(0.5)
    expect(clamp(-1)).toBe(0)
    expect(clamp(2)).toBe(1)
  })

  it('falls back to min for NaN', () => {
    expect(clamp(Number.NaN)).toBe(0)
  })
})

describe('formatRemaining', () => {
  it('reports complete for sub-second durations', () => {
    expect(formatRemaining(0)).toBe('complete')
    expect(formatRemaining(999)).toBe('complete')
  })

  it('uses the two most significant units', () => {
    const ms = 5 * 3600_000 + 12 * 60_000 + 30_000
    expect(formatRemaining(ms)).toBe('5h 12m left')
  })

  it('handles seconds only', () => {
    expect(formatRemaining(43_000)).toBe('43s left')
  })
})

describe('computeMetrics', () => {
  it('returns day, week, month and year metrics', () => {
    const metrics = computeMetrics(new Date('2026-06-15T12:00:00'))
    expect(metrics.map((m) => m.key)).toEqual(['day', 'week', 'month', 'year'])
  })

  it('reports the day half elapsed at noon', () => {
    const metrics = computeMetrics(new Date('2026-06-15T12:00:00'))
    const day = metrics.find((m) => m.key === 'day')!
    expect(day.fraction).toBeCloseTo(0.5, 2)
  })

  it('keeps all fractions within [0, 1]', () => {
    const metrics = computeMetrics(new Date('2026-12-31T23:59:59'))
    for (const metric of metrics) {
      expect(metric.fraction).toBeGreaterThanOrEqual(0)
      expect(metric.fraction).toBeLessThanOrEqual(1)
    }
  })
})
