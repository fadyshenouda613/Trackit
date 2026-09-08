import { describe, expect, it } from 'vitest'
import type { Client, Invoice, Payment, Project } from '@trackit/shared'
import { formatCents } from '@trackit/shared'
import { attentionItems, dashboardMetrics } from './dashboard-rows'
import type { PaymentsByInvoice } from './client-rows'
import type { ProjectFigures } from './project-rows'

const BASE = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  syncState: 'pending' as const
}

const TODAY = '2026-08-28'

const project = (over: Partial<Project> = {}): Project => ({
  ...BASE,
  id: 'p1',
  clientId: 'c1',
  name: 'Project',
  description: '',
  priceCents: 100000,
  currency: 'USD',
  budgetedHours: 10,
  status: 'active',
  kickoffAt: '2026-01-01T00:00:00.000Z',
  dueAt: null,
  deliveredAt: null,
  ...over
})

const client = (over: Partial<Client> = {}): Client => ({
  ...BASE,
  id: 'c1',
  name: 'Jane Doe',
  company: 'Acme Co',
  email: '',
  phone: '',
  address: '',
  currency: 'USD',
  paymentTermsDays: 14,
  notes: '',
  ...over
})

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  ...BASE,
  id: 'i1',
  clientId: 'c1',
  number: 'INV-0001',
  status: 'sent',
  currency: 'USD',
  issuedAt: '2026-08-01T00:00:00.000Z',
  dueAt: '2026-08-08T00:00:00.000Z',
  taxRate: 0,
  subtotalCents: 100000,
  taxCents: 0,
  totalCents: 100000,
  notes: '',
  voidedAt: null,
  voidReason: null,
  replacedByInvoiceId: null,
  ...over
})

const payment = (over: Partial<Payment> = {}): Payment => ({
  ...BASE,
  id: 'pay1',
  invoiceId: 'i1',
  paidAt: '2026-08-10T00:00:00.000Z',
  amountCents: 5000,
  method: 'bank_transfer',
  note: null,
  ...over
})

describe('dashboardMetrics', () => {
  it('sums the unbilled price and count from delivered projects, and finds the oldest by days since delivery', () => {
    const p1 = project({ id: 'p1', status: 'delivered', priceCents: 500000, deliveredAt: '2026-08-16T00:00:00.000Z' })
    const p2 = project({ id: 'p2', status: 'delivered', priceCents: 250000, deliveredAt: '2026-08-23T00:00:00.000Z' })
    const active = project({ id: 'p3', status: 'active', priceCents: 999999 })

    const m = dashboardMetrics([p1, p2, active], [], {}, TODAY)

    expect(m.unbilled).toBe(formatCents(750000))
    expect(m.unbilledCount).toBe(2)
    expect(m.oldestDays).toBe(12)
  })

  it('is null for the oldest age when nothing has been delivered', () => {
    const m = dashboardMetrics([project({ status: 'active' })], [], {}, TODAY)
    expect(m.unbilledCount).toBe(0)
    expect(m.oldestDays).toBeNull()
  })

  it('sums the outstanding balance and count from open invoices, and the overdue balance and days among them', () => {
    // sent, no payment, due 20 days ago -> fully outstanding and overdue
    const overdue = invoice({ id: 'i1', status: 'sent', totalCents: 100000, dueAt: '2026-08-08T00:00:00.000Z' })
    // partial, not yet due -> open and outstanding, but not overdue
    const notYetDue = invoice({ id: 'i2', status: 'partial', totalCents: 50000, dueAt: '2026-09-01T00:00:00.000Z' })
    // paid -> not open at all
    const settled = invoice({ id: 'i3', status: 'paid', totalCents: 40000, dueAt: '2026-08-01T00:00:00.000Z' })
    const payments: PaymentsByInvoice = { i2: [payment({ invoiceId: 'i2', amountCents: 20000 })] }

    const m = dashboardMetrics([], [overdue, notYetDue, settled], payments, TODAY)

    expect(m.outstandingCount).toBe(2)
    expect(m.outstanding).toBe(formatCents(100000 + 30000))
    expect(m.overdue).toBe(formatCents(100000))
    expect(m.overdueDays).toBe(20)
  })

  it('reports no overdue amount or days when nothing open is late', () => {
    const notYetDue = invoice({ id: 'i1', status: 'sent', dueAt: '2026-09-01T00:00:00.000Z' })
    const m = dashboardMetrics([], [notYetDue], {}, TODAY)
    expect(m.overdue).toBeNull()
    expect(m.overdueDays).toBeNull()
  })

  it('sums payments received this month, counts the invoices they settled, and averages the days each took to pay', () => {
    const paidFast = invoice({ id: 'i1', status: 'paid', issuedAt: '2026-08-01T00:00:00.000Z' })
    const paidSlower = invoice({ id: 'i2', status: 'paid', issuedAt: '2026-08-10T00:00:00.000Z' })
    // Paid, but the payment landed last month: excluded from this month's total and average.
    const paidLastMonth = invoice({ id: 'i3', status: 'paid', issuedAt: '2026-07-01T00:00:00.000Z' })
    const payments: PaymentsByInvoice = {
      i1: [payment({ invoiceId: 'i1', paidAt: '2026-08-05T00:00:00.000Z', amountCents: 100000 })],
      i2: [payment({ invoiceId: 'i2', paidAt: '2026-08-16T00:00:00.000Z', amountCents: 50000 })],
      i3: [payment({ invoiceId: 'i3', paidAt: '2026-07-20T00:00:00.000Z', amountCents: 70000 })]
    }

    const m = dashboardMetrics([], [paidFast, paidSlower, paidLastMonth], payments, TODAY)

    expect(m.paidMonth).toBe(formatCents(150000))
    expect(m.paidMonthCount).toBe(2)
    // (4 days + 6 days) / 2 = 5
    expect(m.averageDays).toBe(5)
  })
})

/** A ProjectFigures fixture with every dimension `attentionItems` reads, so a
 *  test overrides only the ones its case is about. */
const figures = (over: Partial<ProjectFigures> = {}): ProjectFigures => ({
  project: project(),
  client: client(),
  symbol: '$',
  entries: [],
  loggedMinutes: 0,
  budgetMinutes: 600,
  budget: { percent: 0, remainingMinutes: 600, overMinutes: 0, over: false },
  checklist: { done: 0, total: 0, percent: 0, later: 0, open: 0 },
  rateCents: 100000,
  ...over
})

const FLOOR = 5000

describe('attentionItems — projects', () => {
  it('picks one branch per project by priority: below floor beats over budget beats 3+ later items beats the warning band', () => {
    // Below the floor — wins even though it is also over budget and has plenty of later items.
    const belowFloor = figures({
      project: project({ id: 'below', name: 'Below floor' }),
      rateCents: 4000,
      loggedMinutes: 125,
      budget: { percent: 150, remainingMinutes: 0, overMinutes: 50, over: true },
      checklist: { done: 1, total: 6, percent: 17, later: 5, open: 5 }
    })
    // Over budget — wins over its own 3+ later items.
    const overBudget = figures({
      project: project({ id: 'over', name: 'Over budget' }),
      rateCents: 100000,
      budget: { percent: 151, remainingMinutes: 0, overMinutes: 100, over: true },
      checklist: { done: 3, total: 6, percent: 50, later: 5, open: 3 }
    })
    // 3+ later items — wins over sitting in the warning band.
    const addedScope = figures({
      project: project({ id: 'scope', name: 'Added scope' }),
      rateCents: 100000,
      budget: { percent: 85, remainingMinutes: 90, overMinutes: 0, over: false },
      checklist: { done: 5, total: 9, percent: 56, later: 4, open: 4 }
    })
    // Warning band alone, one deliverable open (singular copy).
    const watch = figures({
      project: project({ id: 'watch', name: 'Watch me' }),
      rateCents: 100000,
      budget: { percent: 85, remainingMinutes: 90, overMinutes: 0, over: false },
      checklist: { done: 8, total: 9, percent: 89, later: 1, open: 1 }
    })
    // None of the four conditions — produces nothing.
    const fine = figures({
      project: project({ id: 'fine', name: 'Fine' }),
      rateCents: 100000,
      budget: { percent: 50, remainingMinutes: 300, overMinutes: 0, over: false },
      checklist: { done: 2, total: 4, percent: 50, later: 0, open: 2 }
    })
    // Would fail every check, but is not active, so it produces nothing.
    const draft = figures({
      project: project({ id: 'draft-proj', name: 'Still a draft', status: 'draft' }),
      rateCents: 1
    })

    const items = attentionItems(
      [belowFloor, overBudget, addedScope, watch, fine, draft],
      [],
      [],
      {},
      FLOOR,
      TODAY
    )

    expect(items.map((i) => i.key)).toEqual(['p-below', 'p-over', 'p-scope', 'p-watch'])

    expect(items[0]).toMatchObject({
      tone: 'negative',
      subject: 'Renegotiate Below floor',
      detail: '— $40.00/hr, 20% under your $50.00 floor at 2h 05m logged',
      action: 'Open project',
      projectId: 'below'
    })
    expect(items[1]).toMatchObject({
      tone: 'negative',
      subject: 'Re-scope Over budget',
      detail: '— 151% of budgeted hours spent against 3 of 6 deliverables done',
      action: 'Open project'
    })
    expect(items[2]).toMatchObject({
      tone: 'warning',
      subject: 'Bill added scope on Added scope',
      detail: '— 4 deliverables added since kickoff, price unchanged',
      action: 'Review scope'
    })
    expect(items[3]).toMatchObject({
      tone: 'warning',
      subject: 'Watch Watch me',
      detail: '— 85% of budgeted hours used with 1 deliverable open',
      action: 'Open project'
    })
  })
})

describe('attentionItems — invoice chases', () => {
  it('tones a chase by how many days overdue it is, and reads the balance still owed', () => {
    const veryLate = invoice({ id: 'i1', number: 'INV-0140', clientId: 'c1', status: 'sent', totalCents: 100000, dueAt: '2026-08-08T00:00:00.000Z' })
    const slightlyLate = invoice({ id: 'i2', number: 'INV-0141', clientId: 'c2', status: 'partial', totalCents: 80000, dueAt: '2026-08-22T00:00:00.000Z' })
    const clients = [client({ id: 'c1', company: 'Ortega & Co' }), client({ id: 'c2', company: 'Halcyon' })]
    const payments: PaymentsByInvoice = { i2: [payment({ invoiceId: 'i2', amountCents: 20000 })] }

    const items = attentionItems([], [veryLate, slightlyLate], clients, payments, FLOOR, TODAY)

    expect(items).toHaveLength(2)
    // 20 days overdue -> negative; sorts before the 6-days-overdue warning chase.
    expect(items[0]).toMatchObject({
      key: 'inv-i1',
      tone: 'negative',
      subject: 'Chase Ortega & Co',
      detail: '— INV-0140 is 20 days overdue, $1,000.00',
      action: 'Send reminder'
    })
    expect(items[1]).toMatchObject({
      key: 'inv-i2',
      tone: 'warning',
      subject: 'Chase Halcyon',
      detail: '— INV-0141 is 6 days overdue, $600.00',
      action: 'Send reminder'
    })
  })

  it('leaves out invoices that cannot be overdue: settled, voided, drafted, or simply not yet due', () => {
    const paid = invoice({ id: 'i1', status: 'paid', dueAt: '2026-08-01T00:00:00.000Z' })
    const voided = invoice({ id: 'i2', status: 'void', dueAt: '2026-08-01T00:00:00.000Z' })
    const draft = invoice({ id: 'i3', status: 'draft', issuedAt: null, dueAt: null })
    const notDueYet = invoice({ id: 'i4', status: 'sent', dueAt: '2026-09-15T00:00:00.000Z' })

    const items = attentionItems([], [paid, voided, draft, notDueYet], [], {}, FLOOR, TODAY)
    expect(items).toEqual([])
  })

  it('falls back to the invoice number when the client behind it is not loaded', () => {
    const orphaned = invoice({ id: 'i1', number: 'INV-0199', clientId: 'ghost', status: 'sent', dueAt: '2026-08-01T00:00:00.000Z' })
    const items = attentionItems([], [orphaned], [], {}, FLOOR, TODAY)
    expect(items[0].subject).toBe('Chase INV-0199')
  })
})

describe('attentionItems — final ordering', () => {
  it('orders negative chases, then negative projects, then warning projects, then warning chases', () => {
    const negativeProject = figures({
      project: project({ id: 'neg', name: 'Negative project' }),
      rateCents: 1000
    })
    const warningProject = figures({
      project: project({ id: 'warn', name: 'Warning project' }),
      rateCents: 100000,
      budget: { percent: 85, remainingMinutes: 90, overMinutes: 0, over: false },
      checklist: { done: 1, total: 2, percent: 50, later: 0, open: 1 }
    })
    const negativeChase = invoice({ id: 'i-neg', status: 'sent', dueAt: '2026-08-01T00:00:00.000Z' }) // 27 days late
    const warningChase = invoice({ id: 'i-warn', status: 'sent', dueAt: '2026-08-25T00:00:00.000Z' }) // 3 days late

    const items = attentionItems(
      [warningProject, negativeProject],
      [warningChase, negativeChase],
      [],
      {},
      FLOOR,
      TODAY
    )

    expect(items.map((i) => i.key)).toEqual(['inv-i-neg', 'p-neg', 'p-warn', 'inv-i-warn'])
    expect(items.map((i) => i.tone)).toEqual(['negative', 'negative', 'warning', 'warning'])
  })
})
