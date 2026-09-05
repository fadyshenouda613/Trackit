import {
  balanceCents,
  daysBetween,
  effectiveRateCents,
  formatCents,
  formatDuration,
  overdueDays,
  paidCents,
  symbolOf,
  totalMinutes
} from '@trackit/shared'
import type {
  Client,
  Id,
  Invoice,
  InvoiceStatus,
  Note,
  Payment,
  Project,
  ProjectStatus,
  TimeEntry
} from '@trackit/shared'
import { dateLabel, localDateOf, monthYear } from './local-dates'
import { initialsOf, termsLabel } from './terms'

export type PaymentsByInvoice = Record<Id, Payment[]>

export type ClientRow = {
  id: Id
  initials: string
  name: string
  company: string
  activeProjects: string
  lifetime: string
  lifetimeCents: number
  outstanding: string
  outstandingCents: number
  /** "24d late" beside the outstanding figure. */
  late?: string
}
export type ClientTotals = { count: number; active: number; lifetime: string; outstanding: string }

const billed = (invoice: Invoice): boolean => invoice.status !== 'draft' && invoice.status !== 'void'
const open = (invoice: Invoice): boolean => invoice.status === 'sent' || invoice.status === 'partial'

export function clientRow(
  client: Client,
  projects: Project[],
  invoices: Invoice[],
  payments: PaymentsByInvoice,
  today: string
): ClientRow {
  const symbol = symbolOf(client.currency)
  const mine = invoices.filter((i) => i.clientId === client.id && billed(i))
  const lifetimeCents = mine.reduce((sum, i) => sum + i.totalCents, 0)
  const paid = mine.reduce((sum, i) => sum + paidCents(payments[i.id] ?? []), 0)
  const outstandingCents = balanceCents(lifetimeCents, paid)
  const lateDays = mine
    .filter(open)
    .map((i) => overdueDays(i.dueAt, today))
    .filter((d): d is number => d !== null)
  return {
    id: client.id,
    initials: initialsOf(client.name),
    name: client.name,
    company: client.company,
    activeProjects: String(
      projects.filter((p) => p.clientId === client.id && p.status === 'active').length
    ),
    lifetime: formatCents(lifetimeCents, symbol),
    lifetimeCents,
    outstanding: formatCents(outstandingCents, symbol),
    outstandingCents,
    late: lateDays.length ? `${Math.max(...lateDays)}d late` : undefined
  }
}

/** "Sorted by outstanding": most owed first, then most billed. */
export const byOutstanding = (a: ClientRow, b: ClientRow): number =>
  b.outstandingCents - a.outstandingCents || b.lifetimeCents - a.lifetimeCents

export const clientTotals = (rows: ClientRow[], symbol = '$'): ClientTotals => ({
  count: rows.length,
  active: rows.reduce((n, r) => n + Number(r.activeProjects), 0),
  lifetime: formatCents(
    rows.reduce((n, r) => n + r.lifetimeCents, 0),
    symbol
  ),
  outstanding: formatCents(
    rows.reduce((n, r) => n + r.outstandingCents, 0),
    symbol
  )
})

/** '0h 00m' rather than the em dash: a project row always has an hours cell. */
export const hoursLabel = (minutes: number): string => (minutes === 0 ? '0h 00m' : formatDuration(minutes))

export type ClientProjectRow = { id: Id; name: string; status: ProjectStatus; price: string; logged: string; rate: string }
export type ClientInvoiceRow = { id: Id; number: string; issued: string; total: string; status: InvoiceStatus }
export type NoteRow = { id: Id; date: string; body: string }

export function clientProjectRow(p: Project, entries: TimeEntry[], symbol: string, now: string): ClientProjectRow {
  const minutes = totalMinutes(
    entries.filter((e) => e.projectId === p.id),
    now
  )
  const rate = effectiveRateCents(p.priceCents, minutes)
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    price: formatCents(p.priceCents, symbol),
    logged: hoursLabel(minutes),
    rate: rate === null ? '—' : `${formatCents(rate, symbol)}/hr`
  }
}
export const clientInvoiceRow = (i: Invoice): ClientInvoiceRow => ({
  id: i.id,
  number: i.number,
  issued: dateLabel(i.issuedAt),
  total: formatCents(i.totalCents, symbolOf(i.currency)),
  status: i.status
})
export const noteRow = (n: Note): NoteRow => ({ id: n.id, date: dateLabel(n.createdAt), body: n.body })

export type ClientHeader = {
  initials: string
  name: string
  company: string
  email: string
  phone: string
  addressLine: string
  currencyPill: string
  termsPill: string
  lifetime: string
  lifetimeNote: string
  outstanding: string
  outstandingNote: string
  outstandingTone: 'positive' | 'negative' | null
}
export function clientHeader(
  c: Client,
  projects: Project[],
  invoices: Invoice[],
  payments: PaymentsByInvoice,
  today: string
): ClientHeader {
  const symbol = symbolOf(c.currency)
  const mine = invoices.filter(billed)
  const lifetime = mine.reduce((s, i) => s + i.totalCents, 0)
  const paid = mine.reduce((s, i) => s + paidCents(payments[i.id] ?? []), 0)
  const openOnes = mine.filter(open)
  const soonest = openOnes
    .map((i) => i.dueAt)
    .filter((d): d is string => d !== null)
    .sort()[0]
  const late = openOnes
    .map((i) => overdueDays(i.dueAt, today))
    .filter((d): d is number => d !== null)
  const n = openOnes.length
  const noun = n === 1 ? 'invoice' : 'invoices'
  const outstandingNote =
    n === 0
      ? 'Nothing owed'
      : late.length
        ? `${n} ${noun} · ${Math.max(...late)} days overdue`
        : `${n} ${noun} · due in ${daysBetween(today, localDateOf(soonest as string))} days`
  return {
    initials: initialsOf(c.name),
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    addressLine: c.address
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(', '),
    currencyPill: `${c.currency} (${symbol})`,
    termsPill: termsLabel(c.paymentTermsDays),
    lifetime: formatCents(lifetime, symbol),
    lifetimeNote: `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} since ${monthYear(c.createdAt)}`,
    outstanding: formatCents(balanceCents(lifetime, paid), symbol),
    outstandingNote,
    outstandingTone: n === 0 ? null : late.length ? 'negative' : 'positive'
  }
}
