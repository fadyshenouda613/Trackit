import type { JSX } from 'react'
import { EmptyState } from './EmptyState'
import { formatCents, type Client, type Id, type Invoice } from '@trackit/shared'
import { Pill } from './Pill'
import { StatusPill } from './StatusPill'
import { toneVar } from './tone'
import { invoiceRow, overdueLabel, overdueToneOf, summarise } from './invoices-data'
import type { PaymentsByInvoice } from './client-rows'

type InvoicesTableProps = {
  rows: Invoice[]
  /** For the client column: the register stores an id, the table shows a company. */
  clients: Client[]
  payments: PaymentsByInvoice
  today: string
  onOpen: (id: Id) => void
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
export function InvoicesTable({
  rows,
  clients,
  payments,
  today,
  onOpen
}: InvoicesTableProps): JSX.Element {
  const totals = summarise(rows, payments, today)

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
        <EmptyState
          variant="panel"
          title="No invoices match those filters"
          body="Clear one of them to widen the list. The figures above and below count only what is showing."
        />
      )}

      {rows.map((invoice) => {
        const row = invoiceRow(invoice, clients, payments, today)
        const quiet = row.quiet
        const late = row.late

        return (
          <div
            key={row.id}
            className={row.voided ? 'invoices__row invoices__row--dim' : 'invoices__row'}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(row.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen(row.id)
              }
            }}
          >
            <span className="invoices__number">
              {row.number}
              {row.provisional && <Pill>Provisional</Pill>}
            </span>

            <span className="invoices__client truncate">{row.client}</span>

            <span className={quiet ? 'invoices__quiet' : 'invoices__date'}>{row.issued}</span>

            {late === null ? (
              <span className={quiet ? 'invoices__quiet' : 'invoices__date'}>{row.due}</span>
            ) : (
              <span className="invoices__due">
                <span className="invoices__due-date" style={{ color: toneVar[overdueToneOf(late)] }}>
                  {row.due}
                </span>
                <Pill tone={overdueToneOf(late)}>{overdueLabel(late)}</Pill>
              </span>
            )}

            <span className={quiet ? 'align-right invoices__quiet' : 'align-right'}>
              {row.total}
            </span>

            <span
              className={
                row.paid ? 'align-right invoices__received' : 'align-right invoices__quiet'
              }
            >
              {row.paid ?? '—'}
            </span>

            <span>
              <StatusPill status={row.status} />
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

        <span className="align-right invoices__totals-value">{formatCents(totals.billed)}</span>
        <span className="align-right invoices__totals-value">{formatCents(totals.received)}</span>

        <div className="invoices__totals-figure">
          <span className="invoices__totals-value">{formatCents(totals.outstanding)}</span>
          <span className="invoices__totals-caption">
            On {totals.openCount} unpaid
            {totals.overdueCount > 0 ? ` · ${totals.overdueCount} overdue` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

