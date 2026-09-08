import type { JSX } from 'react'
import { EmptyState } from './EmptyState'
import {
  balanceCents,
  formatCents,
  paidCents,
  paymentMethodLabels,
  type Invoice,
  type Payment
} from '@trackit/shared'
import { dateLabel } from './local-dates'
import { symbolFor } from './invoices-data'

type InvoicePaymentsProps = {
  invoice: Invoice
  payments: Payment[]
}

/**
 * What has actually arrived, under the bill that asked for it.
 *
 * A single figure saying "paid $8,000.00" is not enough to reconcile against a
 * bank statement — you need the dates and the methods, because that is what the
 * statement has. So the payments are a list, and the list closes with the one
 * figure the freelancer is really after: what is still owed.
 */
export function InvoicePayments({ invoice, payments }: InvoicePaymentsProps): JSX.Element {
  const status = invoice.status
  const symbol = symbolFor(invoice)
  const received = paidCents(payments)
  const balance = balanceCents(invoice.totalCents, received)
  const settled = balance <= 0 && payments.length > 0

  return (
    <section className="section payments-section">
      <div className="section__head">
        <h3 className="section__title">Payments</h3>
        <span className="section__count">{payments.length}</span>
        {received > 0 && (
          <span className="section__note">
            {formatCents(received, symbol)} of {formatCents(invoice.totalCents, symbol)}
          </span>
        )}
      </div>

      <div className="panel payments">
        {payments.length === 0 ? (
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

            {payments.map((payment) => (
              <div className="payments__row" key={payment.id}>
                <span className="payments__date num">{dateLabel(payment.paidAt)}</span>
                <span className="align-right payments__amount">
                  {formatCents(payment.amountCents, symbol)}
                </span>
                <span className="payments__method">{paymentMethodLabels[payment.method]}</span>
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
            {formatCents(status === 'void' ? 0 : balance, symbol)}
          </span>
          <span className="payments__balance-basis">
            {settled
              ? `Settled ${dateLabel(payments[payments.length - 1].paidAt)}`
              : status === 'void'
                ? 'Voided — nothing is owed'
                : `${formatCents(invoice.totalCents, symbol)} invoiced less ${formatCents(received, symbol)} received`}
          </span>
        </div>
      </div>
    </section>
  )
}
