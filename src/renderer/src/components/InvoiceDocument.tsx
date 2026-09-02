import type { JSX } from 'react'
import { money } from './money'
import {
  billTo,
  business,
  clientOf,
  dateLabel,
  dueOf,
  statusOf,
  subtotalOfInvoice,
  taxOf,
  totalOf,
  type Invoice
} from './invoices-data'

type InvoiceDocumentProps = {
  invoice: Invoice
  /** Opens the invoice a voided one was reissued as. */
  onOpen: (number: string) => void
}

/**
 * What the client receives.
 *
 * The one document in an app of tables, and it stays on the same surface as
 * every other panel — a white sheet would be a second palette to keep true in
 * two themes. It reads as a document typographically instead: wide margins, the
 * sender and the invoice facing each other across the head, a rule, the address
 * it is going to, then the work grouped by project with every amount on one
 * decimal edge, and the total alone at the bottom right where the eye lands.
 *
 * Grouping is the point of the middle. A client who receives a bill for two
 * projects should be able to see which of them is which before agreeing to it,
 * so the group is a heading with its own subtotal — and when there is only one
 * project, that subtotal would just be the invoice total said twice, so it goes.
 */
export function InvoiceDocument({ invoice, onOpen }: InvoiceDocumentProps): JSX.Element {
  const client = clientOf(invoice)
  const voided = invoice.voided
  const subtotal = subtotalOfInvoice(invoice)
  const tax = taxOf(invoice)
  const grouped = invoice.groups.length > 1
  const address = billTo[invoice.clientId] ?? []

  return (
    <div className="doc-wrap">
      {voided && (
        <div className="doc-void" role="status">
          <span className="doc-void__mark t-overline">Void</span>
          <span className="doc-void__text">
            Voided {dateLabel(voided.date)} — {voided.reason.toLowerCase()}.
            {voided.replacedBy && (
              <>
                {' '}
                Reissued as{' '}
                <button
                  type="button"
                  className="doc-void__link"
                  onClick={() => onOpen(voided.replacedBy as string)}
                >
                  {voided.replacedBy}
                </button>
                .
              </>
            )}
          </span>
        </div>
      )}

      <article className={voided ? 'panel doc doc--void' : 'panel doc'}>
        <header className="doc__head">
          <div className="doc__from">
            <span className="doc__from-name">{business.name}</span>
            <span>{business.person}</span>
            {business.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            <span className="doc__from-aside">{business.email}</span>
            <span className="doc__from-aside num">{business.taxId}</span>
          </div>

          <div className="doc__meta">
            <span className="doc__kind t-overline">Invoice</span>
            <span className="doc__number t-mono">{invoice.number}</span>

            <dl className="doc__dates">
              <dt>Issued</dt>
              <dd className="num">{dateLabel(invoice.issued)}</dd>
              <dt>Due</dt>
              <dd className="num">{dateLabel(dueOf(invoice))}</dd>
              <dt>Terms</dt>
              <dd>{client?.terms ?? '—'}</dd>
            </dl>
          </div>
        </header>

        <div className="doc__rule" />

        <div className="doc__bill">
          <span className="t-overline doc__bill-label">Bill to</span>
          <span className="doc__bill-name">{client?.company ?? '—'}</span>
          <span className="doc__bill-line">{client?.contact}</span>
          {address.map((line) => (
            <span className="doc__bill-line" key={line}>
              {line}
            </span>
          ))}
        </div>

        <div className="doc__lines">
          {invoice.groups.map((entry) => {
            const groupTotal = entry.lines.reduce((sum, line) => sum + line.amount, 0)

            return (
              <section className="doc__group" key={entry.project}>
                <div className="doc__group-head">
                  <span className="t-overline doc__group-name">{entry.project}</span>
                  {grouped && <span className="doc__group-total num">{money(groupTotal)}</span>}
                </div>

                {entry.lines.map((line) => (
                  <div className="doc__line" key={line.id}>
                    <span className="doc__line-label">{line.label}</span>
                    <span className="doc__line-amount num">{money(line.amount)}</span>
                  </div>
                ))}
              </section>
            )
          })}
        </div>

        <div className="doc__rule" />

        <footer className="doc__foot">
          {invoice.notes ? (
            <p className="doc__notes">{invoice.notes}</p>
          ) : (
            <span className="doc__notes doc__notes--empty" />
          )}

          <div className="doc__totals">
            <div className="doc__totals-row">
              <span className="doc__totals-label">Subtotal</span>
              <span className="doc__totals-value num">{money(subtotal)}</span>
            </div>

            {/* Only the invoice that has tax on it shows a tax line — a row
                reading 0% on every other invoice is a question with no answer. */}
            {invoice.taxRate > 0 && (
              <div className="doc__totals-row">
                <span className="doc__totals-label">Tax {invoice.taxRate}%</span>
                <span className="doc__totals-value num">{money(tax)}</span>
              </div>
            )}

            <div className="doc__totals-total">
              <span className="doc__totals-total-label">Total</span>
              <span className="doc__totals-total-value num">{money(totalOf(invoice))}</span>
            </div>

            {voided && (
              <span className="doc__stamp" aria-hidden="true">
                Void
              </span>
            )}
          </div>
        </footer>
      </article>

      {statusOf(invoice) === 'draft' && (
        <p className="doc-draft">
          Nothing has been sent. The number is already reserved; the issue and due dates are
          set when you mark it as sent.
        </p>
      )}
    </div>
  )
}
