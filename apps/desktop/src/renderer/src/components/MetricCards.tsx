import type { JSX } from 'react'

/** The three money figures across the top of the dashboard. */
export function MetricCards(): JSX.Element {
  return (
    <div className="metrics">
      <section className="metric">
        <div className="metric__head">
          <span className="t-overline metric__label">Unbilled</span>
          <div className="spacer" />
          <span className="metric__chip">Ready to invoice</span>
        </div>
        <span className="metric__value">$14,650.00</span>
        <span className="metric__meta">3 delivered projects · oldest sat 12 days</span>
      </section>

      <section className="metric">
        <span className="t-overline metric__label">Outstanding</span>
        <span className="metric__value">$11,450.00</span>
        <div className="metric__meta">
          <span>5 invoices</span>
          <span className="metric__sep">·</span>
          <span style={{ color: 'var(--negative)' }}>$2,100.00 overdue 24 days</span>
        </div>
      </section>

      <section className="metric">
        <span className="t-overline metric__label">Paid this month</span>
        <span className="metric__value">$8,240.00</span>
        <span className="metric__meta">4 invoices · 11 days average to pay</span>
      </section>
    </div>
  )
}
