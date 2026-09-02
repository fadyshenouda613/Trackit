import type { JSX } from 'react'
import { money } from './money'
import { Pill } from './Pill'
import { StatusPill } from './StatusPill'
import { toneVar } from './tone'
import {
  clientOf,
  dateLabel,
  dueOf,
  overdueDaysOf,
  overdueLabel,
  overdueToneOf,
  paidOf,
  statusOf,
  summarise,
  totalOf,
  type Invoice
} from './invoices-data'

type InvoicesTableProps = {
  rows: Invoice[]
  onOpen: (number: string) => void
}

/**
 * The register as a table, in the idiom the other three tables share: an
 * overline header, hoverable rows, and a totals row on the footer tone.
 *
 * The one thing it does that they do not is carry overdue, and it carries it on
 * the due date rather than on the status. An invoice that is late is still an
 * invoice that was sent — lateness is a fact about the date it passed, so the
 * date cell is where it is drawn, and the status column stays a clean read of
 * the five states. Amber to a fortnight, red past it: a slow payer and a
 * collection are different problems and should not look the same.
 */
export function InvoicesTable({ rows, onOpen }: InvoicesTableProps): JSX.Element {
  const totals = summarise(rows)

  return (
    <div className="panel invoices">
      <div className="invoices__header t-overline">
        <span>Number</span>
        <span>Client</span>
        <span>Issued</span>
        <span>Due</span>
        <span className="align-right">Total</span>
        <span className="align-right">Paid</span>
        <span>Status</span>
      </div>

      {rows.length === 0 && (
        <div className="invoices__empty">
          <p className="invoices__empty-title">No invoices match those filters</p>
          <p className="invoices__empty-body">
            Clear one of them to widen the list. The figures above and below count only what
            is showing.
          </p>
        </div>
      )}

      {rows.map((invoice) => {
        const status = statusOf(invoice)
        const draft = status === 'draft'
        const voided = status === 'void'
        const quiet = draft || voided
        const late = overdueDaysOf(invoice)
        const received = paidOf(invoice)
        const client = clientOf(invoice)

        return (
          <div
            key={invoice.number}
            className={voided ? 'invoices__row invoices__row--dim' : 'invoices__row'}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(invoice.number)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen(invoice.number)
              }
            }}
          >
            <span className="invoices__number">{invoice.number}</span>

            <span className="invoices__client truncate">{client?.company ?? '—'}</span>

            <span className={quiet ? 'invoices__quiet' : 'invoices__date'}>
              {dateLabel(invoice.issued)}
            </span>

            {late === null ? (
              <span className={quiet ? 'invoices__quiet' : 'invoices__date'}>
                {dateLabel(dueOf(invoice))}
              </span>
            ) : (
              <span className="invoices__due">
                <span className="invoices__due-date" style={{ color: toneVar[overdueToneOf(late)] }}>
                  {dateLabel(dueOf(invoice))}
                </span>
                <Pill tone={overdueToneOf(late)}>{overdueLabel(late)}</Pill>
              </span>
            )}

            <span className={quiet ? 'align-right invoices__quiet' : 'align-right'}>
              {money(totalOf(invoice))}
            </span>

            <span
              className={
                received > 0 ? 'align-right invoices__received' : 'align-right invoices__quiet'
              }
            >
              {received > 0 ? money(received) : '—'}
            </span>

            <span>
              <StatusPill status={status} />
            </span>
          </div>
        )
      })}

      {/*
       * A draft has not been billed and a void one never will be, so neither
       * belongs in any of the three figures — the same basis the all-projects
       * totals use, and stated for the same reason: a total nobody can
       * reconstruct is a total nobody trusts.
       */}
      <div className="invoices__row invoices__totals">
        <div className="invoices__totals-head">
          <span className="invoices__totals-title">
            {totals.count} {totals.count === 1 ? 'invoice' : 'invoices'}
          </span>
          <span className="invoices__totals-basis">
            Drafts and voided invoices excluded from all three figures
          </span>
        </div>

        <span className="align-right invoices__totals-value">{money(totals.billed)}</span>
        <span className="align-right invoices__totals-value">{money(totals.received)}</span>

        <div className="invoices__totals-figure">
          <span className="invoices__totals-value">{money(totals.outstanding)}</span>
          <span className="invoices__totals-caption">
            On {totals.openCount} unpaid
            {totals.overdueCount > 0 ? ` · ${totals.overdueCount} overdue` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

