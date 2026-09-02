import { clientById, type BillingClient } from './invoice-data'
import { TODAY, addDays, daysBetween, shortDate } from './time-data'
import type { Status } from './status'

/*
 * The invoice register.
 *
 * Nothing here is free invention. Four screens already state the position in
 * numbers, and this file has to agree with all of them:
 *
 *   MetricCards   Outstanding $11,450.00 over 5 invoices, $2,100.00 overdue 24 days
 *                 Paid this month $8,240.00 over 4 invoices, 11 days average to pay
 *   ClientsTable  the Outstanding column totals $21,660.00 across those same 5 clients
 *   AttentionList INV-0142 is 24 days overdue at $2,100.00; INV-0139 is 6 days at $860.00
 *   ClientDetail  Northwind's four invoices, their numbers, dates, totals and statuses
 *
 * The Dashboard and the Clients screen appear to disagree by $10,210.00. They do
 * not: Clients totals what was billed and is still open, the Dashboard totals what
 * is still owed on it. Part-payments are the difference — which is also where the
 * two partially paid rows come from, rather than being staged for the pill.
 *
 * Due dates are derived from the client's terms rather than stored, so a term and
 * a due date can never drift apart.
 */

export type PaymentMethod = 'Bank transfer' | 'Card' | 'Cheque' | 'Cash' | 'PayPal' | 'Other'

export const paymentMethods: PaymentMethod[] = [
  'Bank transfer',
  'Card',
  'Cheque',
  'Cash',
  'PayPal',
  'Other'
]

export type Payment = {
  id: string
  /** ISO, like every other date the app holds. */
  date: string
  amount: number
  method: PaymentMethod
  note?: string
}

/** Lines belong to a project. The document prints the grouping, so it is structural. */
export type LineGroup = {
  project: string
  lines: { id: string; label: string; amount: number }[]
}

export type Invoice = {
  number: string
  /** Joins billingClients in invoice-data.ts and the rows in ClientsTable. */
  clientId: string
  /** ISO. Null on a draft — an unissued invoice has no date and no due date. */
  issued: string | null
  groups: LineGroup[]
  /** Per cent. Zero everywhere but INV-0104, which is the one that proves the row. */
  taxRate: number
  payments: Payment[]
  notes?: string
  voided?: { date: string; reason: string; replacedBy?: string }
}

/*
 * Who the invoice is from. Settings has no screen yet, so this is the one place
 * the business states itself; when Settings arrives it should read from there.
 */
export const business = {
  name: 'Ledgerline Studio',
  person: 'Alex Marchetti',
  lines: ['2130 Fillmore Street, Studio 4', 'San Francisco, CA 94115'],
  email: 'billing@ledgerline.studio',
  taxId: 'EIN 84-3927104'
}

/*
 * Where each invoice is sent. Northwind's is the address ClientDetail already
 * prints; the rest have never been stated anywhere and are seeded here.
 */
export const billTo: Record<string, string[]> = {
  sable: ['1180 Valencia Street', 'San Francisco, CA 94110'],
  northwind: ['418 Turk Street', 'San Francisco, CA 94102'],
  kestrel: ['64 Cowcross Street', 'London EC1M 6BP'],
  ortega: ['Carrer de Girona 88, 3r', '08009 Barcelona'],
  halcyon: ['920 Harrison Street, Floor 2', 'San Francisco, CA 94107'],
  marlow: ['77 Kingsland Road', 'Portland, OR 97209'],
  brandt: ['1400 Locust Street, Suite 900', 'Philadelphia, PA 19102'],
  meridian: ['308 Divisadero Street', 'San Francisco, CA 94117']
}

const group = (project: string, lines: [string, number][]): LineGroup => ({
  project,
  lines: lines.map(([label, amount], index) => ({
    id: `${project}-${index}`,
    label,
    amount
  }))
})

const paid = (
  id: string,
  date: string,
  amount: number,
  method: PaymentMethod,
  note?: string
): Payment => ({ id, date, amount, method, note })

/*
 * Newest first, which is the order the list opens in and the order ClientDetail
 * already shows Northwind's four in.
 */
export const invoices: Invoice[] = [
  {
    number: 'INV-0149',
    clientId: 'brandt',
    issued: null,
    taxRate: 0,
    groups: [
      group('Annual report layout', [
        ['Editorial grid and master pages', 2200],
        ['Section layouts, 48 pages', 2400],
        ['Print-ready artwork', 800]
      ])
    ],
    payments: []
  },
  {
    number: 'INV-0148',
    clientId: 'northwind',
    issued: '2026-08-24',
    taxRate: 0,
    groups: [
      group('Brand refresh', [
        ['Logo lockups', 2400],
        ['Type system and scale', 1600],
        ['Colour system', 1300],
        ['Brand guidelines', 1200]
      ])
    ],
    payments: [],
    notes: 'Bank details as before. Two revision rounds included, as agreed at kickoff.'
  },
  {
    number: 'INV-0147',
    clientId: 'kestrel',
    issued: '2026-08-20',
    taxRate: 0,
    groups: [
      group('Editorial templates', [
        ['Master page set', 1400],
        ['Style sheets and type scale', 1000],
        ['Handover documentation', 800]
      ])
    ],
    payments: [paid('p-0147-1', '2026-08-24', 2210, 'Bank transfer', 'First instalment')]
  },
  {
    number: 'INV-0146',
    clientId: 'meridian',
    issued: '2026-08-12',
    taxRate: 0,
    groups: [
      group('Menu system', [
        ['Menu grid and typesetting', 1500],
        ['Seasonal insert templates', 750],
        ['Print specification', 500]
      ])
    ],
    payments: [paid('p-0146-1', '2026-08-21', 2750, 'Bank transfer')]
  },
  {
    number: 'INV-0145',
    clientId: 'sable',
    issued: '2026-08-12',
    taxRate: 0,
    groups: [
      group('Site build', [
        ['Component library', 3200],
        ['Page templates, nine screens', 3000],
        ['Auth and account screens', 1800],
        ['Responsive pass', 1000]
      ])
    ],
    payments: [
      paid('p-0145-1', '2026-08-14', 5000, 'Bank transfer', 'Deposit'),
      paid('p-0145-2', '2026-08-21', 3000, 'Bank transfer')
    ],
    notes: 'Balance due on sign-off of the responsive pass.'
  },
  {
    number: 'INV-0144',
    clientId: 'brandt',
    issued: '2026-07-30',
    taxRate: 0,
    groups: [
      group('Investor deck', [
        ['Slide master and grid', 1200],
        ['Chart system', 900],
        ['Twelve slides laid out', 800]
      ])
    ],
    payments: [paid('p-0144-1', '2026-08-13', 2900, 'Bank transfer')]
  },
  {
    number: 'INV-0143',
    clientId: 'marlow',
    issued: '2026-07-29',
    taxRate: 0,
    groups: [
      group('Label revisions', [
        ['Nutrition panel redraw', 740],
        ['Four SKU label updates', 620],
        ['Repro and print check', 330]
      ])
    ],
    payments: [paid('p-0143-1', '2026-08-05', 1690, 'Card')]
  },
  {
    number: 'INV-0142',
    clientId: 'ortega',
    issued: '2026-07-28',
    taxRate: 0,
    groups: [
      group('Report design', [['Chart styling, section 3', 450]]),
      group('Quarterly deck refresh', [
        ['Template rebuild', 950],
        ['Data visual pass', 700]
      ])
    ],
    payments: [],
    notes: 'Second reminder sent 18 Aug.'
  },
  {
    number: 'INV-0141',
    clientId: 'halcyon',
    issued: '2026-07-24',
    taxRate: 0,
    groups: [
      group('Launch email set', [
        ['Three campaign emails', 600],
        ['Responsive testing', 300]
      ])
    ],
    payments: [paid('p-0141-1', '2026-08-07', 900, 'PayPal')]
  },
  {
    number: 'INV-0139',
    clientId: 'halcyon',
    issued: '2026-08-22',
    taxRate: 0,
    groups: [
      group('Onboarding emails', [
        ['Welcome sequence copy edit', 520],
        ['Template adjustments', 340]
      ])
    ],
    payments: [],
    notes: 'Due on receipt.'
  },
  {
    number: 'INV-0138',
    clientId: 'ortega',
    issued: '2026-07-18',
    taxRate: 0,
    groups: [
      group('Brand sheet', [
        ['One-page brand sheet', 950],
        ['Two revision rounds', 500]
      ])
    ],
    payments: [paid('p-0138-1', '2026-07-24', 1450, 'Bank transfer')]
  },
  {
    /* The void case, and the reason it exists: it went to the wrong client and
       was reissued the same day as INV-0138, which is on the list above it. */
    number: 'INV-0137',
    clientId: 'kestrel',
    issued: '2026-07-15',
    taxRate: 0,
    groups: [
      group('Brand sheet', [
        ['One-page brand sheet', 950],
        ['Two revision rounds', 500]
      ])
    ],
    payments: [],
    voided: {
      date: '2026-07-18',
      reason: 'Issued to the wrong client',
      replacedBy: 'INV-0138'
    }
  },
  {
    number: 'INV-0131',
    clientId: 'northwind',
    issued: '2026-07-02',
    taxRate: 0,
    groups: [
      group('Site copy refresh', [
        ['Homepage and about copy', 1400],
        ['Product pages, six', 1000]
      ])
    ],
    payments: [paid('p-0131-1', '2026-07-08', 2400, 'Bank transfer')]
  },
  {
    number: 'INV-0122',
    clientId: 'marlow',
    issued: '2026-06-05',
    taxRate: 0,
    groups: [
      group('Wholesale one-pager', [
        ['One-pager layout', 600],
        ['Print-ready artwork', 300]
      ])
    ],
    payments: [paid('p-0122-1', '2026-06-11', 900, 'Cheque')]
  },
  {
    number: 'INV-0119',
    clientId: 'northwind',
    issued: '2026-05-14',
    taxRate: 0,
    groups: [
      group('Packaging refresh 2025', [
        ['Structural dielines', 3600],
        ['Six carton artworks', 4200],
        ['Repro and press check', 2000]
      ])
    ],
    payments: [paid('p-0119-1', '2026-05-22', 9800, 'Bank transfer')]
  },
  {
    /* The one invoice with tax on it, so the tax row is exercised somewhere:
       $6,000.00 at 20% is the $7,200.00 ClientDetail states. */
    number: 'INV-0104',
    clientId: 'northwind',
    issued: '2026-03-03',
    taxRate: 20,
    groups: [
      group('Identity refresh', [
        ['Wordmark refinement', 2600],
        ['Stationery set', 1900],
        ['Digital asset pack', 1500]
      ])
    ],
    payments: [paid('p-0104-1', '2026-03-10', 7200, 'Bank transfer')]
  }
]

/* ---- Reading one invoice ---------------------------------------------------
 * Every figure the three screens show is derived here, so the list footer, the
 * document totals and the payment dialog cannot arrive at different answers. */

export const clientOf = (invoice: Invoice): BillingClient | null => clientById(invoice.clientId)

export const subtotalOfInvoice = (invoice: Invoice): number =>
  invoice.groups.reduce(
    (sum, entry) => sum + entry.lines.reduce((inner, line) => inner + line.amount, 0),
    0
  )

export const taxOf = (invoice: Invoice): number =>
  (subtotalOfInvoice(invoice) * invoice.taxRate) / 100

export const totalOf = (invoice: Invoice): number => subtotalOfInvoice(invoice) + taxOf(invoice)

export const paidOf = (invoice: Invoice): number =>
  invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)

export const balanceOf = (invoice: Invoice): number => totalOf(invoice) - paidOf(invoice)

/** Null on a draft, which has no issue date to be due from. */
export const dueOf = (invoice: Invoice): string | null => {
  const client = clientOf(invoice)
  if (!invoice.issued || !client) return null
  return addDays(invoice.issued, client.termDays)
}

/**
 * Five states, and the two new ones carry their meaning: a part-paid invoice is
 * not sent any more, and a void one is not a stage of anything.
 */
export function statusOf(invoice: Invoice): Status {
  if (invoice.voided) return 'void'
  if (!invoice.issued) return 'draft'
  if (balanceOf(invoice) <= 0) return 'paid'
  return paidOf(invoice) > 0 ? 'partial' : 'sent'
}

/** Days past due, or null. A void, draft or settled invoice is never overdue. */
export function overdueDaysOf(invoice: Invoice): number | null {
  const status = statusOf(invoice)
  if (status !== 'sent' && status !== 'partial') return null
  const due = dueOf(invoice)
  if (!due || due >= TODAY) return null
  return daysBetween(due, TODAY)
}

/**
 * Late and very late are different problems: a fortnight is a slow payer, past
 * that is a collection. The tone lands on the due date and never on the status
 * pill — the state of the invoice is that it was sent; being late is a fact
 * about the date, and that is the cell it belongs in.
 */
export const overdueToneOf = (days: number): 'warning' | 'negative' =>
  days <= 14 ? 'warning' : 'negative'

export const overdueLabel = (days: number): string => `${days}d overdue`

/** A register date, in the form every invoice prints it. */
export const dateLabel = (iso: string | null): string => (iso ? shortDate(iso) : '—')

export const byNumber = (number: string): Invoice | null =>
  invoices.find((invoice) => invoice.number === number) ?? null

/* ---- Reading the whole register --------------------------------------------
 * The list header and the list footer are the same arithmetic over the same
 * rows, so they are one function. Filtering the table narrows both together. */

export type Summary = {
  count: number
  /** Billed, received and outstanding all exclude drafts and voids. */
  billed: number
  received: number
  outstanding: number
  openCount: number
  overdueCount: number
  overdueAmount: number
}

export function summarise(rows: Invoice[]): Summary {
  let billed = 0
  let received = 0
  let openCount = 0
  let overdueCount = 0
  let overdueAmount = 0

  for (const invoice of rows) {
    const status = statusOf(invoice)
    if (status === 'draft' || status === 'void') continue

    billed += totalOf(invoice)
    received += paidOf(invoice)

    const balance = balanceOf(invoice)
    if (balance > 0) openCount += 1

    if (overdueDaysOf(invoice) !== null) {
      overdueCount += 1
      overdueAmount += balance
    }
  }

  return {
    count: rows.length,
    billed,
    received,
    outstanding: billed - received,
    openCount,
    overdueCount,
    overdueAmount
  }
}
