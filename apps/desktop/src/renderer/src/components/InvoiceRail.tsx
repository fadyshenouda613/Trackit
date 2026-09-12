import type { JSX } from 'react'
import { formatCents, invoiceTotals } from '@trackit/shared'

type InvoiceRailProps = {
  /** The number the scheme expects. Shown, not typed: the server issues the real one on save. */
  expectedNumber: string
  issue: string
  due: string
  /** "Net 14", "Due on receipt" — the reason the due date is what it is. */
  terms: string | null
  taxRate: string
  onTaxRate: (value: string) => void
  /** Cents, or null before a client is chosen: nothing yet to be a subtotal of. */
  subtotalCents: number | null
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
  expectedNumber,
  issue,
  due,
  terms,
  taxRate,
  onTaxRate,
  subtotalCents,
  notes,
  onNotes,
  symbol
}: InvoiceRailProps): JSX.Element {
  const rate = taxRate.trim() === '' ? null : Number(taxRate)
  const valid = rate !== null && Number.isFinite(rate) && rate >= 0
  /* The same three figures the store will snapshot, so what the rail adds up
     and what the invoice ends up carrying cannot differ by a rounded cent. */
  const totals =
    subtotalCents === null
      ? null
      : invoiceTotals([{ amountCents: subtotalCents }], valid ? (rate as number) : 0)
  const tax = totals !== null && valid ? totals.taxCents : null
  const total = totals === null ? null : totals.totalCents

  return (
    <aside className="rail invoice__rail" aria-label="Invoice details">
      <section className="panel rail__card">
        <span className="t-overline rail__title">Invoice</span>

        {/* Read-only, like the dates beneath it: a number is issued, not
            chosen, because two machines choosing would eventually choose the
            same one. What is shown is the scheme's next value — what the
            draft holds, marked provisional, if the server cannot be asked. */}
        <div className="inv-field">
          <label htmlFor="inv-number">Number</label>
          <input
            id="inv-number"
            type="text"
            className="field field--filled t-mono inv-field__control"
            value={expectedNumber}
            readOnly
          />
        </div>
        <span className="rail__aside">
          Issued when you save. Offline, the draft keeps this number as provisional until it has synced.
        </span>

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
            {subtotalCents === null ? '—' : formatCents(subtotalCents, symbol)}
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
          <span className="inv-totals__value num">{tax === null ? '—' : formatCents(tax, symbol)}</span>
        </div>

        <div className="inv-totals__total">
          <span className="inv-totals__total-label">Total</span>
          <span className="inv-totals__total-value num">
            {total === null ? '—' : formatCents(total, symbol)}
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
