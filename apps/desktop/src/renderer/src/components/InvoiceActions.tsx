import { useState, type JSX } from 'react'
import { balanceCents, formatCents, type Invoice } from '@trackit/shared'
import { toneVar } from './tone'
import { StatusPill } from './StatusPill'
import { dateLabel } from './local-dates'
import { overdueDaysOf, overdueToneOf, symbolFor } from './invoices-data'

type InvoiceActionsProps = {
  invoice: Invoice
  /** Cents received, summed by the detail from the invoice's payments. */
  paid: number
  today: string
  onMarkSent: () => void
  onRecordPayment: () => void
  onVoid: () => void
}

/**
 * What is true of the invoice, and the small number of things you can do about
 * it. The dates are not repeated here — the document beside this prints them,
 * and a rail that restates the sheet is a second copy to keep true.
 *
 * One step forward takes the weight, the way a project detail gives its single
 * advancing action the primary button and puts everything else in a quieter
 * register. Voiding is the only destructive thing an invoice can do, so it sits
 * below a rule in the danger colour, and disappears entirely once money has
 * been received in full: you cannot unsay a paid invoice.
 */
export function InvoiceActions({
  invoice,
  paid,
  today,
  onMarkSent,
  onRecordPayment,
  onVoid
}: InvoiceActionsProps): JSX.Element {
  const status = invoice.status
  const symbol = symbolFor(invoice)
  const balance = balanceCents(invoice.totalCents, paid)
  const late = overdueDaysOf(invoice, today)
  const [confirming, setConfirming] = useState(false)

  const settled = status === 'paid'
  const closed = settled || status === 'void'

  const aside = (): string => {
    if (status === 'void') return 'Voided. It counts towards nothing.'
    if (status === 'draft') return 'Not issued. No money is expected yet.'
    if (settled) return `Settled in full against ${formatCents(invoice.totalCents, symbol)} invoiced.`
    if (late !== null) {
      return `${late} days past the ${dateLabel(invoice.dueAt)} due date.`
    }
    if (paid > 0) {
      return `${formatCents(paid, symbol)} received of ${formatCents(invoice.totalCents, symbol)}.`
    }
    return `Due ${dateLabel(invoice.dueAt)}.`
  }

  return (
    <aside className="rail invoice__rail" aria-label="Invoice actions">
      <section className="panel rail__card inv-state">
        <div className="inv-state__head">
          <span className="t-overline rail__title">Status</span>
          <div className="spacer" />
          <StatusPill status={status} />
        </div>

        <div className="inv-state__figure">
          <span className="inv-state__label">
            {settled ? 'Paid in full' : status === 'void' ? 'Nothing owed' : 'Remaining'}
          </span>
          <span
            className="inv-state__value"
            style={settled ? { color: 'var(--positive)' } : undefined}
          >
            {status === 'void' ? '—' : formatCents(settled ? 0 : balance, symbol)}
          </span>
        </div>

        {/* An invoice 24 days late should not state that in the same grey as
            everything else. Same two steps the list uses on the due date. */}
        <span
          className="rail__aside"
          style={late === null ? undefined : { color: toneVar[overdueToneOf(late)] }}
        >
          {aside()}
        </span>
      </section>

      <section className="panel rail__card inv-acts">
        <span className="t-overline rail__title">Actions</span>

        {status === 'draft' && (
          <button type="button" className="button button--primary inv-acts__button" onClick={onMarkSent}>
            Mark as sent
          </button>
        )}

        {(status === 'sent' || status === 'partial') && (
          <button
            type="button"
            className="button button--primary inv-acts__button"
            onClick={onRecordPayment}
          >
            Record payment
          </button>
        )}

        <button type="button" className="button inv-acts__button">
          Download PDF
        </button>

        {!closed && (
          <>
            <div className="inv-acts__rule" />

            {/* Two taps, not a dialog. Voiding is the only destructive thing an
                invoice can do, and it deserves a pause — but a modal over a
                document to ask one question is a heavier interruption than the
                question is worth. */}
            {confirming ? (
              <div className="inv-acts__confirm">
                <span className="inv-acts__confirm-text">
                  Void {invoice.number}? It stays on the list, numbered and dimmed,
                  counting towards nothing.
                </span>
                <div className="inv-acts__confirm-row">
                  <button
                    type="button"
                    className="button inv-acts__button"
                    onClick={() => setConfirming(false)}
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    className="button inv-acts__button inv-acts__button--danger"
                    onClick={onVoid}
                  >
                    Void it
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="button inv-acts__button inv-acts__button--danger"
                onClick={() => setConfirming(true)}
              >
                Void invoice
              </button>
            )}
          </>
        )}
      </section>
    </aside>
  )
}
