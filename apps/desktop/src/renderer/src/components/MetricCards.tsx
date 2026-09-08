import type { JSX } from 'react'
import { dashboardMetrics } from './dashboard-rows'
import { plural } from './terms'
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
            ? `${plural(m.unbilledCount, 'delivered project')}${
                m.oldestDays !== null ? ` · oldest sat ${plural(m.oldestDays, 'day')}` : ''
              }`
            : '—'}
        </span>
      </section>

      <section className="metric">
        <span className="t-overline metric__label">Outstanding</span>
        <span className="metric__value">{m ? m.outstanding : '—'}</span>
        <div className="metric__meta">
          <span>{m ? plural(m.outstandingCount, 'invoice') : '—'}</span>
          {m && (
            <>
              <span className="metric__sep">·</span>
              {m.overdue !== null ? (
                <span style={{ color: 'var(--negative)' }}>
                  {m.overdue} overdue {plural(m.overdueDays ?? 0, 'day')}
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
            ? `${plural(m.paidMonthCount, 'invoice')}${
                m.averageDays !== null ? ` · ${plural(m.averageDays, 'day')} average to pay` : ''
              }`
            : '—'}
        </span>
      </section>
    </div>
  )
}
