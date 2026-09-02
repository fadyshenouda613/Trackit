import { clientRows } from './ClientsTable'
import { TODAY, addDays, shortDate } from './time-data'

/*
 * The model behind the Create invoice screen.
 *
 * Client names and contacts come from `clientRows` so the selector can never
 * drift from the Clients screen. Billing terms and the delivered work hang off
 * them here, because no other screen has needed them yet.
 *
 * The delivered work below reconciles with the Dashboard, which already states
 * the unbilled position as "$14,650.00 · 3 delivered projects": Trade show
 * panels, Signage artwork and Annual report layout come to exactly that. The
 * first and third are the two the Projects table lists at the same prices; the
 * second is the one the Dashboard counts and that table does not show.
 */

/** A delivered project, and whether it has already gone out on an invoice. */
export type BillableProject = {
  id: string
  name: string
  /** ISO, so the due date arithmetic and the display share one source. */
  delivered: string
  price: number
  /** The invoice it is already on. Present means: shown, dimmed, not tickable. */
  invoicedOn?: string
}

export type BillingClient = {
  id: string
  company: string
  contact: string
  currency: string
  terms: string
  /** Days from issue to due, the number behind `terms`. */
  termDays: number
  delivered: BillableProject[]
  /** Projects still running. Only the empty state has anything to say about them. */
  openProjects: number
}

/** A row on the invoice. `projectId` is absent on a line typed by hand. */
export type InvoiceLine = {
  id: string
  label: string
  amount: number
  projectId?: string
}

const contactFor = (id: string): { company: string; contact: string } => {
  const row = clientRows.find((client) => client.id === id)
  return { company: row?.company ?? '', contact: row?.name ?? '' }
}

const client = (
  id: string,
  currency: string,
  terms: string,
  termDays: number,
  openProjects: number,
  delivered: BillableProject[]
): BillingClient => ({ id, ...contactFor(id), currency, terms, termDays, openProjects, delivered })

/*
 * Every client on file gets a seed, so the selector never lands on a blank.
 * Three of them carry the states the screen has to prove:
 *
 *   northwind  work to bill, with one row already invoiced
 *   kestrel    nothing delivered yet
 *   meridian   everything delivered is already on an invoice
 */
export const billingClients: BillingClient[] = [
  client('northwind', 'USD ($)', 'Net 14', 14, 1, [
    { id: 'nw-panels', name: 'Trade show panels', delivered: '2026-08-26', price: 3400 },
    { id: 'nw-signage', name: 'Signage artwork', delivered: '2026-08-21', price: 5850 },
    {
      id: 'nw-copy',
      name: 'Site copy refresh',
      delivered: '2026-06-28',
      price: 2400,
      invoicedOn: 'INV-0131'
    }
  ]),
  client('sable', 'USD ($)', 'Net 30', 30, 1, []),
  client('kestrel', 'USD ($)', 'Net 30', 30, 2, []),
  client('ortega', 'USD ($)', 'Net 7', 7, 1, []),
  client('halcyon', 'USD ($)', 'Due on receipt', 0, 1, []),
  client('marlow', 'USD ($)', 'Net 14', 14, 1, [
    {
      id: 'mf-onepager',
      name: 'Wholesale one-pager',
      delivered: '2026-06-02',
      price: 900,
      invoicedOn: 'INV-0122'
    }
  ]),
  client('brandt', 'USD ($)', 'Net 30', 30, 0, [
    { id: 'bv-annual', name: 'Annual report layout', delivered: '2026-08-19', price: 5400 }
  ]),
  client('meridian', 'USD ($)', 'Net 14', 14, 0, [
    {
      id: 'mc-menu',
      name: 'Menu system',
      delivered: '2026-08-11',
      price: 2750,
      invoicedOn: 'INV-0146'
    }
  ])
]

export const clientById = (id: string): BillingClient | null =>
  billingClients.find((entry) => entry.id === id) ?? null

/** Follows INV-0149, the draft already sitting at the top of the Invoices list. */
export const NEXT_NUMBER = 'INV-0150'

export const ISSUE_DATE = shortDate(TODAY)

/** "Net 14" from today. Due on receipt is the issue date itself. */
export const dueDateFor = (termDays: number): string => shortDate(addDays(TODAY, termDays))

export const subtotalOf = (lines: InvoiceLine[]): number =>
  lines.reduce((sum, line) => sum + line.amount, 0)

/** The delivered date as an invoice would print it. */
export const deliveredLabel = (project: BillableProject): string => shortDate(project.delivered)

let nextLineId = 0

/** Free-text lines need an id that cannot collide with a project's. */
export const newLineId = (): string => `line-${(nextLineId += 1)}`

/** "GBP (£)" is how a client's currency is written; the invoice needs the "£". */
export const symbolFor = (currency: string): string => currency.match(/\(([^)]+)\)/)?.[1] ?? '$'
