import { SORT_ORDER_STEP, balanceCents, daysBetween, formatCents, groupInvoiceLines, overdueDays, overdueJudgement, paidCents, subtotalCents, symbolOf, type InvoiceLineGroup } from '@trackit/shared'
import type { Client, CurrencyCode, Id, Invoice, InvoiceLine, InvoiceStatus, NewInvoiceInput, Project } from '@trackit/shared'
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

export type LineGroup = InvoiceLineGroup<InvoiceLine>
/** Lines grouped by the project they were ticked from, in line order; hand-typed lines form one group. The grouping is the shared one, so the server's PDF sums the same groups. */
export const groupLines = (lines: InvoiceLine[], projects: Project[]): LineGroup[] =>
  groupInvoiceLines(lines, (projectId) => projects.find((p) => p.id === projectId)?.name)

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

/**
 * What the Create invoice screen offers a client: the delivered work that can
 * still be billed, and — dimmed, never hidden — the delivered work that has
 * already gone out. A row that disappears reads as something lost; a row that
 * dims reads as something accounted for, and answers "didn't I already bill
 * that?" without leaving the screen.
 */
export type BillableRow = { project: Project; delivered: string; invoicedOn: string | null }
export type BillableView = { company: string; rows: BillableRow[]; billable: Project[]; openProjects: number }
export function billableView(
  client: Client,
  projects: Project[],
  billable: Project[],
  invoiceOf: Record<Id, Invoice | null>
): BillableView {
  const billed = projects.filter(
    (p) =>
      p.status === 'invoiced' ||
      p.status === 'paid' ||
      (p.status === 'delivered' && !billable.some((b) => b.id === p.id))
  )
  const rows = [
    ...billable.map((p) => ({ project: p, invoicedOn: null as string | null })),
    ...billed.map((p) => ({ project: p, invoicedOn: invoiceOf[p.id]?.number ?? 'an invoice' }))
  ]
    .map((r) => ({ ...r, delivered: dateLabel(r.project.deliveredAt) }))
    .sort((a, b) => (b.project.deliveredAt ?? '').localeCompare(a.project.deliveredAt ?? ''))
  return {
    company: client.company,
    rows,
    billable,
    openProjects: projects.filter((p) => p.status === 'draft' || p.status === 'active').length
  }
}

/**
 * The draft as the store takes it. The label and amount travel with every
 * line, project-ticked ones included: what the client is told they are paying
 * for is the freelancer's words at this moment, not the project's name later.
 */
export function toNewInvoiceInput(a: {
  clientId: Id
  number: string
  currency: CurrencyCode
  taxRate: string
  notes: string
  lines: LineDraft[]
}): NewInvoiceInput {
  const rate = Number(a.taxRate.trim() || 0)
  return {
    id: crypto.randomUUID(),
    clientId: a.clientId,
    number: a.number.trim() || undefined,
    currency: a.currency,
    taxRate: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0,
    notes: a.notes,
    lines: a.lines.map((l, i) => ({
      id: l.id,
      projectId: l.projectId,
      milestoneId: null,
      label: l.label.trim(),
      amountCents: l.amountCents,
      sortOrder: (i + 1) * SORT_ORDER_STEP
    }))
  }
}
