import type { JSX } from 'react'
import { dashboardMetrics } from './dashboard-rows'
import { todayIso } from './local-dates'
import { useInvoiceFigures } from './use-invoice-figures'
import { useInvoices } from '../data/use-invoices'
import { useProjects } from '../data/use-projects'

/** The three money figures across the top of the dashboard. */
export function MetricCards(): JSX.Element {
  const projects = useProjects()
  const invoices = useInvoices()
  const { payments, isPending: paymentsPending } = useInvoiceFigures(invoices.data)

  const pending = projects.isPending || invoices.isPending || paymentsPending
  const m = pending
    ? null
    : dashboardMetrics(projects.data ?? [], invoices.data ?? [], payments, todayIso())

  return (
    <div className="metrics">
      <section className="metric">
        <div className="metric__head">
          <span className="t-overline metric__label">Unbilled</span>
          <div className="spacer" />
          <span className="metric__chip">Ready to invoice</span>
        </div>
        <span className="metric__value">{m ? m.unbilled : '—'}</span>
        <span className="metric__meta">
          {m
            ? `${m.unbilledCount} delivered projects${
                m.oldestDays !== null ? ` · oldest sat ${m.oldestDays} days` : ''
              }`
            : '—'}
        </span>
      </section>

      <section className="metric">
        <span className="t-overline metric__label">Outstanding</span>
        <span className="metric__value">{m ? m.outstanding : '—'}</span>
        <div className="metric__meta">
          <span>{m ? `${m.outstandingCount} invoices` : '—'}</span>
          {m && (
            <>
              <span className="metric__sep">·</span>
              {m.overdue !== null ? (
                <span style={{ color: 'var(--negative)' }}>
                  {m.overdue} overdue {m.overdueDays} days
                </span>
              ) : (
                <span>Nothing overdue</span>
              )}
            </>
          )}
        </div>
      </section>

      <section className="metric">
        <span className="t-overline metric__label">Paid this month</span>
        <span className="metric__value">{m ? m.paidMonth : '—'}</span>
        <span className="metric__meta">
          {m
            ? `${m.paidMonthCount} invoices${
                m.averageDays !== null ? ` · ${m.averageDays} days average to pay` : ''
              }`
            : '—'}
        </span>
      </section>
    </div>
  )
}
