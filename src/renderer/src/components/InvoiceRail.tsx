import type { JSX } from 'react'
import { money } from './money'

type InvoiceRailProps = {
  number: string
  onNumber: (value: string) => void
  issue: string
  due: string
  /** "Net 14", "Due on receipt" — the reason the due date is what it is. */
  terms: string | null
  taxRate: string
  onTaxRate: (value: string) => void
  /** Null before a client is chosen: there is nothing yet to be a subtotal of. */
  subtotal: number | null
  notes: string
  onNotes: (value: string) => void
  symbol: string
}

/**
 * The three things that are true of the invoice as a whole rather than of any
 * one line: what it is called and when it is owed, what it comes to, and
 * whatever has to be said alongside the figures.
 *
 * Only the total takes weight. A subtotal and a tax line are the working; the
 * total is the number the client acts on, and the one the freelancer checks
 * before sending.
 */
export function InvoiceRail({
  number,
  onNumber,
  issue,
  due,
  terms,
  taxRate,
  onTaxRate,
  subtotal,
  notes,
  onNotes,
  symbol
}: InvoiceRailProps): JSX.Element {
  const rate = taxRate.trim() === '' ? null : Number(taxRate)
  const valid = rate !== null && Number.isFinite(rate) && rate >= 0
  const tax = subtotal !== null && valid ? (subtotal * rate) / 100 : null
  const total = subtotal === null ? null : subtotal + (tax ?? 0)

  return (
    <aside className="rail invoice__rail" aria-label="Invoice details">
      <section className="panel rail__card">
        <span className="t-overline rail__title">Invoice</span>

        <div className="inv-field">
          <label htmlFor="inv-number">Number</label>
          <input
            id="inv-number"
            type="text"
            className="field field--filled t-mono inv-field__control"
            value={number}
            onChange={(event) => onNumber(event.target.value)}
          />
        </div>

        <div className="inv-field">
          <label htmlFor="inv-issue">Issue date</label>
          <input
            id="inv-issue"
            type="text"
            className="field field--filled num inv-field__control"
            value={issue}
            readOnly
          />
        </div>

        <div className="inv-field">
          <label htmlFor="inv-due">Due date</label>
          <input
            id="inv-due"
            type="text"
            className="field field--filled num inv-field__control"
            value={due}
            readOnly
          />
        </div>

        <span className="rail__aside">
          {terms ? `${terms} from the issue date` : 'Choose a client to set the terms'}
        </span>
      </section>

      <section className="panel rail__card inv-totals">
        <span className="t-overline rail__title">Totals</span>

        <div className="inv-totals__row">
          <span className="inv-totals__label">Subtotal</span>
          <span className="inv-totals__value num">
            {subtotal === null ? '—' : money(subtotal, symbol)}
          </span>
        </div>

        <div className="inv-totals__row">
          <label className="inv-totals__label" htmlFor="inv-tax">
            Tax
          </label>
          <div className="inv-rate">
            <input
              id="inv-tax"
              type="text"
              className="inv-rate__input num"
              placeholder="0"
              value={taxRate}
              onChange={(event) => onTaxRate(event.target.value)}
            />
            <span className="inv-rate__suffix">%</span>
          </div>
          <span className="inv-totals__value num">{tax === null ? '—' : money(tax, symbol)}</span>
        </div>

        <div className="inv-totals__total">
          <span className="inv-totals__total-label">Total</span>
          <span className="inv-totals__total-value num">
            {total === null ? '—' : money(total, symbol)}
          </span>
        </div>
      </section>

      <section className="panel rail__card">
        <span className="t-overline rail__title">Notes</span>
        <textarea
          rows={4}
          aria-label="Invoice notes"
          placeholder="Payment details, thanks, anything the client should read."
          className={notes ? 'field field--filled inv-notes' : 'field inv-notes'}
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
        />
        <span className="rail__aside">Printed at the foot of the invoice.</span>
      </section>
    </aside>
  )
}
