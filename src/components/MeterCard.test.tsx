import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MeterCard } from './MeterCard'
import type { Metric } from '../lib/dayMetrics'

const metric: Metric = {
  key: 'day',
  label: 'Day',
  fraction: 0.5,
  remainingLabel: '12h left',
}

describe('MeterCard', () => {
  it('renders label, percentage and remaining time', () => {
    render(<MeterCard metric={metric} />)
    expect(screen.getByText('Day')).toBeInTheDocument()
    expect(screen.getByText('50.0%')).toBeInTheDocument()
    expect(screen.getByText('12h left')).toBeInTheDocument()
  })

  it('exposes an accessible progressbar', () => {
    render(<MeterCard metric={metric} />)
    const bar = screen.getByRole('progressbar', { name: /day elapsed/i })
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })
})
