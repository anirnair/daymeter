import type { Metric } from '../lib/dayMetrics'

interface MeterCardProps {
  metric: Metric
}

export function MeterCard({ metric }: MeterCardProps) {
  const percent = metric.fraction * 100
  const rounded = Math.round(percent * 10) / 10

  return (
    <article className="meter" data-testid={`meter-${metric.key}`}>
      <div className="meter__top">
        <h2 className="meter__label">{metric.label}</h2>
        <span className="meter__percent">{rounded.toFixed(1)}%</span>
      </div>

      <div
        className="meter__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-label={`${metric.label} elapsed`}
      >
        <div className="meter__fill" style={{ width: `${percent}%` }} />
      </div>

      <p className="meter__remaining">{metric.remainingLabel}</p>
    </article>
  )
}
