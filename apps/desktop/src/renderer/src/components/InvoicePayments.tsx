import type { JSX } from 'react'
import { EmptyState } from './EmptyState'
import { money } from './money'
import {
  balanceOf,
  dateLabel,
  paidOf,
  statusOf,
  totalOf,
  type Invoice
} from './invoices-data'

type InvoicePaymentsProps = {
  invoice: Invoice
}

/**
 * What has actually arrived, under the bill that asked for it.
 *
 * A single figure saying "paid $8,000.00" is not enough to reconcile against a
 * bank statement — you need the dates and the methods, because that is what the
 * statement has. So the payments are a list, and the list closes with the one
 * figure the freelancer is really after: what is still owed.
 */
export function InvoicePayments({ invoice }: InvoicePaymentsProps): JSX.Element {
  const status = statusOf(invoice)
  const balance = balanceOf(invoice)
  const received = paidOf(invoice)
  const settled = balance <= 0 && invoice.payments.length > 0

  return (
    <section className="section payments-section">
      <div className="section__head">
        <h3 className="section__title">Payments</h3>
        <span className="section__count">{invoice.payments.length}</span>
        {received > 0 && (
          <span className="section__note">
            {money(received)} of {money(totalOf(invoice))}
          </span>
        )}
      </div>

      <div className="panel payments">
        {invoice.payments.length === 0 ? (
          <EmptyState
            variant="panel"
            title={
              status === 'void'
                ? 'Nothing was received'
                : status === 'draft'
                  ? 'Nothing can be received yet'
                  : 'No payments recorded yet'
            }
            body={
              status === 'void'
                ? 'This invoice was voided before any money arrived against it.'
                : status === 'draft'
                  ? 'This invoice has not been sent, so there is nothing for the client to pay.'
                  : 'Record one as it lands and the balance below follows.'
            }
          />
        ) : (
          <>
            <div className="payments__header t-overline">
              <span>Date</span>
              <span className="align-right">Amount</span>
              <span>Method</span>
              <span>Note</span>
            </div>

            {invoice.payments.map((payment) => (
              <div className="payments__row" key={payment.id}>
                <span className="payments__date num">{dateLabel(payment.date)}</span>
                <span className="align-right payments__amount">{money(payment.amount)}</span>
                <span className="payments__method">{payment.method}</span>
                <span className="payments__note truncate">{payment.note ?? '—'}</span>
              </div>
            ))}
          </>
        )}

        <div className="payments__row payments__balance">
          <span className="payments__balance-label">
            {settled ? 'Paid in full' : 'Remaining balance'}
          </span>
          <span
            className="align-right payments__balance-value"
            style={settled ? { color: 'var(--positive)' } : undefined}
          >
            {money(status === 'void' ? 0 : balance)}
          </span>
          <span className="payments__balance-basis">
            {settled
              ? `Settled ${dateLabel(invoice.payments[invoice.payments.length - 1].date)}`
              : status === 'void'
                ? 'Voided — nothing is owed'
                : `${money(totalOf(invoice))} invoiced less ${money(received)} received`}
          </span>
        </div>
      </div>
    </section>
  )
}
