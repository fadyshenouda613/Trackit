import type { JSX } from 'react'
import { formatCents, type Client, type Id, type Invoice, type Settings } from '@trackit/shared'
import { dateLabel } from './local-dates'
import { symbolFor, type LineGroup } from './invoices-data'
import { termsLabel } from './terms'

type InvoiceDocumentProps = {
  invoice: Invoice
  /** The lines as the document sets them: one section per project billed. */
  lines: LineGroup[]
  client: Client | null
  /** The business profile the sheet is sent from. */
  settings: Settings
  /** The invoice a voided one was reissued as, when there is one. */
  replacedBy: { id: Id; number: string } | null
  /** Opens that reissued invoice. */
  onOpen: (id: Id) => void
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
export function InvoiceDocument({
  invoice,
  lines,
  client,
  settings,
  replacedBy,
  onOpen
}: InvoiceDocumentProps): JSX.Element {
  const voided = invoice.status === 'void'
  const symbol = symbolFor(invoice)
  const grouped = lines.length > 1
  const from = settings.address.split('\n').filter(Boolean)
  const address = (client?.address ?? '').split('\n').filter(Boolean)

  return (
    <div className="doc-wrap">
      {voided && (
        <div className="doc-void" role="status">
          <span className="doc-void__mark t-overline">Void</span>
          <span className="doc-void__text">
            Voided {dateLabel(invoice.voidedAt)} — {invoice.voidReason?.toLowerCase()}.
            {replacedBy && (
              <>
                {' '}
                Reissued as{' '}
                <button
                  type="button"
                  className="doc-void__link"
                  onClick={() => onOpen(replacedBy.id)}
                >
                  {replacedBy.number}
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
            <span className="doc__from-name">{settings.businessName || settings.person}</span>
            <span>{settings.person}</span>
            {from.map((line) => (
              <span key={line}>{line}</span>
            ))}
            <span className="doc__from-aside">{settings.email}</span>
            {/* The slot the artboard gave a tax id, which no schema carries.
                The phone is the other line a client might have to use, and an
                empty one is no line at all. */}
            {settings.phone && <span className="doc__from-aside num">{settings.phone}</span>}
          </div>

          <div className="doc__meta">
            <span className="doc__kind t-overline">Invoice</span>
            <span className="doc__number t-mono">{invoice.number}</span>

            <dl className="doc__dates">
              <dt>Issued</dt>
              <dd className="num">{dateLabel(invoice.issuedAt)}</dd>
              <dt>Due</dt>
              <dd className="num">{dateLabel(invoice.dueAt)}</dd>
              <dt>Terms</dt>
              <dd>{client ? termsLabel(client.paymentTermsDays) : '—'}</dd>
            </dl>
          </div>
        </header>

        <div className="doc__rule" />

        <div className="doc__bill">
          <span className="t-overline doc__bill-label">Bill to</span>
          <span className="doc__bill-name">{client?.company ?? '—'}</span>
          <span className="doc__bill-line">{client?.name}</span>
          {address.map((line) => (
            <span className="doc__bill-line" key={line}>
              {line}
            </span>
          ))}
        </div>

        <div className="doc__lines">
          {lines.map((entry) => (
            <section className="doc__group" key={entry.key}>
              <div className="doc__group-head">
                <span className="t-overline doc__group-name">{entry.project}</span>
                {grouped && (
                  <span className="doc__group-total num">
                    {formatCents(entry.totalCents, symbol)}
                  </span>
                )}
              </div>

              {entry.lines.map((line) => (
                <div className="doc__line" key={line.id}>
                  <span className="doc__line-label">{line.label}</span>
                  <span className="doc__line-amount num">
                    {formatCents(line.amountCents, symbol)}
                  </span>
                </div>
              ))}
            </section>
          ))}
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
              <span className="doc__totals-value num">
                {formatCents(invoice.subtotalCents, symbol)}
              </span>
            </div>

            {/* Only the invoice that has tax on it shows a tax line — a row
                reading 0% on every other invoice is a question with no answer. */}
            {invoice.taxRate > 0 && (
              <div className="doc__totals-row">
                <span className="doc__totals-label">Tax {invoice.taxRate}%</span>
                <span className="doc__totals-value num">
                  {formatCents(invoice.taxCents, symbol)}
                </span>
              </div>
            )}

            <div className="doc__totals-total">
              <span className="doc__totals-total-label">Total</span>
              <span className="doc__totals-total-value num">
                {formatCents(invoice.totalCents, symbol)}
              </span>
            </div>

            {voided && (
              <span className="doc__stamp" aria-hidden="true">
                Void
              </span>
            )}
          </div>
        </footer>
      </article>

      {invoice.status === 'draft' && (
        <p className="doc-draft">
          Nothing has been sent. The number is already reserved; the issue and due dates are
          set when you mark it as sent.
        </p>
      )}
    </div>
  )
}
