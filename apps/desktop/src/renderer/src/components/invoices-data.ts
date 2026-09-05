import { balanceCents, daysBetween, formatCents, overdueDays, overdueJudgement, paidCents, subtotalCents, symbolOf, bySortOrder } from '@trackit/shared'
import type { Client, Id, Invoice, InvoiceLine, InvoiceStatus, Project } from '@trackit/shared'
import { dateLabel, localDateOf } from './local-dates'
import type { PaymentsByInvoice } from './client-rows'

export const paidOf = (invoice: Invoice, payments: PaymentsByInvoice): number => paidCents(payments[invoice.id] ?? [])
export const balanceOf = (invoice: Invoice, payments: PaymentsByInvoice): number => balanceCents(invoice.totalCents, paidOf(invoice, payments))
export const symbolFor = (invoice: Invoice): string => symbolOf(invoice.currency)
export const clientOf = (invoice: Invoice, clients: Client[]): Client | null => clients.find((c) => c.id === invoice.clientId) ?? null
/** The store keeps `status` current (sent → partial → paid follow the balance): read, not derived. */
export const isOpen = (invoice: Invoice): boolean => invoice.status === 'sent' || invoice.status === 'partial'
/** Days past due, or null. A void, draft or settled invoice is never overdue. */
export const overdueDaysOf = (invoice: Invoice, today: string): number | null => (isOpen(invoice) ? overdueDays(invoice.dueAt, today) : null)
export const overdueToneOf = overdueJudgement
export const overdueLabel = (days: number): string => `${days}d overdue`

export type LineGroup = { key: string; project: string; lines: InvoiceLine[]; totalCents: number }
/** Lines grouped by the project they were ticked from, in line order; hand-typed lines form one group. */
export function groupLines(lines: InvoiceLine[], projects: Project[]): LineGroup[] {
  const groups = new Map<string, LineGroup>()
  for (const line of [...lines].sort(bySortOrder)) {
    const key = line.projectId ?? 'manual'
    const group = groups.get(key) ?? { key, project: projects.find((p) => p.id === line.projectId)?.name ?? 'Other', lines: [], totalCents: 0 }
    group.lines.push(line)
    group.totalCents += line.amountCents
    groups.set(key, group)
  }
  return [...groups.values()]
}

export type InvoiceRow = { id: Id; number: string; client: string; issued: string; due: string; late: number | null; total: string; paid: string | null; status: InvoiceStatus; quiet: boolean; voided: boolean }
export function invoiceRow(i: Invoice, clients: Client[], payments: PaymentsByInvoice, today: string): InvoiceRow {
  const symbol = symbolFor(i)
  const paid = paidOf(i, payments)
  return {
    id: i.id, number: i.number, client: clientOf(i, clients)?.company ?? '—', issued: dateLabel(i.issuedAt), due: dateLabel(i.dueAt),
    late: overdueDaysOf(i, today), total: formatCents(i.totalCents, symbol), paid: paid > 0 ? formatCents(paid, symbol) : null,
    status: i.status, quiet: i.status === 'draft' || i.status === 'void', voided: i.status === 'void'
  }
}

/** All cents. */
export type Summary = { count: number; billed: number; received: number; outstanding: number; openCount: number; overdueCount: number; overdueAmount: number }
export function summarise(rows: Invoice[], payments: PaymentsByInvoice, today: string): Summary {
  let billed = 0, received = 0, openCount = 0, overdueCount = 0, overdueAmount = 0
  for (const invoice of rows) {
    if (invoice.status === 'draft' || invoice.status === 'void') continue
    billed += invoice.totalCents
    const paid = paidOf(invoice, payments)
    received += paid
    const balance = balanceCents(invoice.totalCents, paid)
    if (balance > 0) openCount += 1
    if (overdueDaysOf(invoice, today) !== null) { overdueCount += 1; overdueAmount += balance }
  }
  return { count: rows.length, billed, received, outstanding: billed - received, openCount, overdueCount, overdueAmount }
}

/** Whole days from issue to the payment that settled, averaged over settled invoices. */
export function averageDaysToPay(invoices: Invoice[], payments: PaymentsByInvoice): number | null {
  const days = invoices.filter((i) => i.status === 'paid' && i.issuedAt).map((i) => {
    const last = (payments[i.id] ?? []).map((p) => p.paidAt).sort().at(-1)
    return last ? daysBetween(localDateOf(i.issuedAt as string), localDateOf(last)) : null
  }).filter((d): d is number => d !== null)
  return days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null
}

/* ---- The Create invoice screen's draft model (moved here from invoice-data.ts, which is deleted) ---- */
export type LineDraft = { id: Id; label: string; amountCents: number; projectId: Id | null }
export const lineFromProject = (p: Project): LineDraft => ({ id: crypto.randomUUID(), label: p.name, amountCents: p.priceCents, projectId: p.id })
export const newLine = (label: string): LineDraft => ({ id: crypto.randomUUID(), label, amountCents: 0, projectId: null })
export const draftSubtotal = (lines: LineDraft[]): number => subtotalCents(lines)
