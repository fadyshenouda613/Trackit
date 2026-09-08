import type { JSX } from 'react'
import { Logo } from './Logo'
import { formatCents, type Id } from '@trackit/shared'
import { bank, paymentTermsProse } from './printed-invoice-data'
import { groupLines, symbolFor } from './invoices-data'
import { dateLabel } from './local-dates'
import { termsLabel } from './terms'
import { useClient } from '../data/use-clients'
import { useInvoice, useInvoiceLines } from '../data/use-invoices'
import { useProjects } from '../data/use-projects'
import { useSettings } from '../data/use-settings'

type PrintedInvoiceProps = {
  /** Any invoice on file prints; the app hands over whichever one is open. */
  invoiceId: Id
}

/**
 * The invoice as the client receives it. A4, on paper.
 *
 * This is not the app. InvoiceDocument beside it is the panel you read inside
 * the Invoices screen, and it stays on the app's surface because a white sheet
 * inside a dark window would be a second palette to keep true in two themes.
 * Here there is no second palette to keep — there is only paper, and the sheet
 * declares its own ink rather than borrowing a token that flips.
 *
 * The page is set at true A4, 794 x 1123 at 96dpi, at the type sizes that
 * actually print. An artboard scaled to fit the window would let every
 * measurement on it be wrong by the same factor and still look right.
 *
 * Order is the order a client reads in: who it is from and what it is, who it
 * is for, what the work was, what it comes to, and then — at the foot, where
 * someone who has decided to pay goes looking — how to pay it.
 */
export function PrintedInvoice({ invoiceId }: PrintedInvoiceProps): JSX.Element | null {
  const invoice = useInvoice(invoiceId)
  const lines = useInvoiceLines(invoiceId)
  const record = invoice.data ?? null
  const client = useClient(record?.clientId ?? null)
  const projects = useProjects({ clientId: record?.clientId })
  const settings = useSettings()

  /* A sheet is either the whole document or nothing: a half-printed invoice
     with skeleton bars where the money goes is worse than a blank frame. */
  if (!record || !settings.data) return null

  const business = settings.data
  const bill = client.data ?? null
  const symbol = symbolFor(record)
  const from = business.address.split('\n').filter(Boolean)
  const address = (bill?.address ?? '').split('\n').filter(Boolean)
  const groups = groupLines(lines.data ?? [], projects.data ?? [])
  /* One project's subtotal would be the invoice total said twice. The in-app
     document draws the same conclusion; stating it identically is the point. */
  const grouped = groups.length > 1

  return (
    <div className="print-board">
      <article className="paper">
        <header className="paper__head">
          <div className="paper__from">
            <div className="paper__brand">
              <Logo size={26} tone="print" />
              <span className="paper__brand-name">
                {business.businessName || business.person}
              </span>
            </div>
            <span className="paper__from-person">{business.person}</span>
            {from.map((line) => (
              <span key={line}>{line}</span>
            ))}
            <span>{business.email}</span>
            {/* The slot the artboard gave a tax id, which no schema carries. */}
            {business.phone && <span className="num">{business.phone}</span>}
          </div>

          <div className="paper__meta">
            <span className="paper__kind">Invoice</span>
            <span className="paper__number num">{record.number}</span>

            <dl className="paper__dates">
              <dt>Issued</dt>
              <dd className="num">{dateLabel(record.issuedAt)}</dd>
              <dt>Due</dt>
              <dd className="num">{dateLabel(record.dueAt)}</dd>
              <dt>Terms</dt>
              <dd>{bill ? termsLabel(bill.paymentTermsDays) : '—'}</dd>
            </dl>
          </div>
        </header>

        <div className="paper__rule" />

        <div className="paper__bill">
          <span className="paper__overline">Bill to</span>
          <span className="paper__bill-name">{bill?.company ?? '—'}</span>
          {bill?.name && <span className="paper__bill-line">{bill.name}</span>}
          {address.map((line) => (
            <span className="paper__bill-line" key={line}>
              {line}
            </span>
          ))}
        </div>

        <div className="paper__items">
          {/* Said once, at the top of the column, rather than over every group. */}
          <div className="paper__columns">
            <span className="paper__overline">Description</span>
            <span className="paper__overline paper__amount">Amount</span>
          </div>

          {groups.map((entry) => (
            <section className="paper__group" key={entry.key}>
              <h2 className="paper__group-name">{entry.project}</h2>

              {entry.lines.map((line) => (
                <div className="paper__line" key={line.id}>
                  <span>{line.label}</span>
                  <span className="paper__amount num">
                    {formatCents(line.amountCents, symbol)}
                  </span>
                </div>
              ))}

              {grouped && (
                <div className="paper__group-total">
                  <span>{entry.project} subtotal</span>
                  <span className="paper__amount num">
                    {formatCents(entry.totalCents, symbol)}
                  </span>
                </div>
              )}
            </section>
          ))}
        </div>

        <div className="paper__totals">
          <div className="paper__totals-row">
            <span>Subtotal</span>
            <span className="paper__amount num">{formatCents(record.subtotalCents, symbol)}</span>
          </div>

          {/* A row reading 0% is a question with no answer, so it only appears
              on an invoice that actually carries tax. */}
          {record.taxRate > 0 && (
            <div className="paper__totals-row">
              <span>Sales tax {record.taxRate}%</span>
              <span className="paper__amount num">{formatCents(record.taxCents, symbol)}</span>
            </div>
          )}

          <div className="paper__total">
            <span className="paper__total-label">Total due</span>
            <span className="paper__amount num">{formatCents(record.totalCents, symbol)}</span>
          </div>
        </div>

        {/* Pushes the foot to the bottom of the sheet on a short invoice, and
            simply gives way on a long one. */}
        <div className="paper__gap" />

        <footer className="paper__foot">
          <div className="paper__terms">
            <span className="paper__overline">Payment terms</span>
            <p className="paper__prose">{paymentTermsProse(bill?.paymentTermsDays ?? 0)}</p>

            {record.notes && (
              <>
                <span className="paper__overline paper__overline--spaced">Notes</span>
                <p className="paper__prose">{record.notes}</p>
              </>
            )}
          </div>

          {/* The one block on the sheet with a fill behind it: it is the thing
              the reader has to act on, and the only thing they will copy out. */}
          <div className="paper__bank">
            <span className="paper__overline">Payment details</span>
            <dl className="paper__bank-list">
              <dt>Bank</dt>
              <dd>{bank.name}</dd>
              <dt>Account name</dt>
              <dd>{bank.account}</dd>
              <dt>Routing</dt>
              <dd className="num">{bank.routing}</dd>
              <dt>Account</dt>
              <dd className="num">{bank.number}</dd>
              <dt>SWIFT</dt>
              <dd className="num">{bank.swift}</dd>
              <dt>Reference</dt>
              <dd className="num paper__bank-ref">{record.number}</dd>
            </dl>
          </div>
        </footer>

        <div className="paper__strip">
          <span>
            {business.businessName || business.person} · {business.email}
          </span>
          <span className="num">
            {record.number} · Page 1 of 1
          </span>
        </div>
      </article>
    </div>
  )
}
