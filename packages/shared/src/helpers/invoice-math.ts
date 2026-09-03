/**
 * Reading an invoice: every figure the list footer, the document and the
 * payment dialog show is derived here, so they cannot arrive at different
 * answers. Cents in, cents out.
 */
import type { InvoiceStatus } from '../schemas/invoice'
import { addDays, dateOf, daysBetween } from './dates'
import type { Judgement } from './rate'

export const subtotalCents = (lines: { amountCents: number }[]): number =>
  lines.reduce((sum, line) => sum + line.amountCents, 0)

/** Tax on a subtotal at a per-cent rate, rounded to the cent. */
export const taxCents = (subtotal: number, taxRate: number): number =>
  Math.round((subtotal * taxRate) / 100)

export type InvoiceTotals = {
  subtotalCents: number
  taxCents: number
  totalCents: number
}

/** The three figures an invoice snapshots. */
export function invoiceTotals(lines: { amountCents: number }[], taxRate: number): InvoiceTotals {
  const subtotal = subtotalCents(lines)
  const tax = taxCents(subtotal, taxRate)
  return { subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax }
}

export const paidCents = (payments: { amountCents: number }[]): number =>
  payments.reduce((sum, payment) => sum + payment.amountCents, 0)

/** What is still owed. Negative when overpaid. */
export const balanceCents = (totalCents: number, paid: number): number => totalCents - paid

/**
 * Five states, and the two beyond draft/sent/paid carry their meaning: a
 * part-paid invoice is not sent any more, and a void one is not a stage of
 * anything.
 */
export function invoiceStatusOf(invoice: {
  voided: boolean
  issued: boolean
  totalCents: number
  paidCents: number
}): InvoiceStatus {
  if (invoice.voided) return 'void'
  if (!invoice.issued) return 'draft'
  if (balanceCents(invoice.totalCents, invoice.paidCents) <= 0) return 'paid'
  return invoice.paidCents > 0 ? 'partial' : 'sent'
}

/** The due date an issue date and a client's terms produce, as `YYYY-MM-DD`. */
export const dueDateOf = (issuedAt: string, termDays: number): string =>
  addDays(dateOf(issuedAt), termDays)

/**
 * Days past due as of `today`, or null: not yet due, or nothing to be due
 * from. Whether the invoice is in a state that can be overdue at all is the
 * caller's to decide — a void, draft or settled invoice never is.
 */
export function overdueDays(dueAt: string | null, today: string): number | null {
  if (!dueAt) return null
  const due = dateOf(dueAt)
  const now = dateOf(today)
  if (due >= now) return null
  return daysBetween(due, now)
}

/**
 * Late and very late are different problems: a fortnight is a slow payer,
 * past that is a collection.
 */
export const overdueJudgement = (days: number): Exclude<Judgement, 'positive'> =>
  days <= 14 ? 'warning' : 'negative'
