import { describe, expect, it } from 'vitest'
import type { Invoice, InvoiceLine, Payment, Project } from '@trackit/shared'
import {
  averageDaysToPay,
  draftSubtotal,
  groupLines,
  isOpen,
  lineFromProject,
  newLine,
  overdueDaysOf,
  summarise
} from './invoices-data'
import type { PaymentsByInvoice } from './client-rows'

const BASE = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, syncState: 'pending' as const }

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
  subtotalCents: 10000,
  taxCents: 0,
  totalCents: 10000,
  notes: '',
  voidedAt: null,
  voidReason: null,
  replacedByInvoiceId: null,
  ...over
})

const line = (over: Partial<InvoiceLine> = {}): InvoiceLine => ({
  ...BASE,
  id: 'l1',
  invoiceId: 'i1',
  projectId: null,
  milestoneId: null,
  label: 'Line',
  amountCents: 1000,
  sortOrder: 1,
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

const project = (over: Partial<Project> = {}): Project => ({
  ...BASE,
  id: 'p1',
  clientId: 'c1',
  name: 'Project One',
  description: '',
  priceCents: 250000,
  currency: 'USD',
  budgetedHours: 10,
  status: 'active',
  kickoffAt: '2026-01-01T00:00:00.000Z',
  dueAt: null,
  deliveredAt: null,
  ...over
})

describe('groupLines', () => {
  it('groups by project in sortOrder, and hand-typed lines form one "manual" group', () => {
    const l2 = line({ id: 'l2', projectId: 'p1', sortOrder: 1, amountCents: 300 })
    const l1 = line({ id: 'l1', projectId: 'p1', sortOrder: 2, amountCents: 700 })
    const l3 = line({ id: 'l3', projectId: null, sortOrder: 3, amountCents: 200, label: 'Hand-typed' })
    const projects = [project({ id: 'p1', name: 'Project One' })]

    const groups = groupLines([l1, l2, l3], projects)

    expect(groups).toHaveLength(2)
    expect(groups[0].key).toBe('p1')
    expect(groups[0].project).toBe('Project One')
    // sortOrder puts l2 (order 1) ahead of l1 (order 2) within the group
    expect(groups[0].lines.map((l) => l.id)).toEqual(['l2', 'l1'])
    expect(groups[0].totalCents).toBe(1000)
    expect(groups[1].key).toBe('manual')
    expect(groups[1].project).toBe('Other')
    expect(groups[1].totalCents).toBe(200)
  })
})

describe('isOpen / overdueDaysOf', () => {
  it('is overdue only for a sent or partial invoice past its due date', () => {
    const sentLate = invoice({ status: 'sent', dueAt: '2026-08-08T00:00:00.000Z' })
    const paidLate = invoice({ status: 'paid', dueAt: '2026-08-08T00:00:00.000Z' })
    const voidLate = invoice({ status: 'void', dueAt: '2026-08-08T00:00:00.000Z' })
    const draft = invoice({ status: 'draft', issuedAt: null, dueAt: null })
    const today = '2026-08-28'

    expect(isOpen(sentLate)).toBe(true)
    expect(overdueDaysOf(sentLate, today)).toBe(20)
    expect(overdueDaysOf(paidLate, today)).toBeNull()
    expect(overdueDaysOf(voidLate, today)).toBeNull()
    expect(overdueDaysOf(draft, today)).toBeNull()
  })
})

describe('summarise', () => {
  it('skips drafts and voids, and counts overdue balances', () => {
    const sentOverdue = invoice({ id: 'i1', status: 'sent', totalCents: 10000, dueAt: '2026-08-08T00:00:00.000Z' })
    const paidInFull = invoice({ id: 'i2', status: 'paid', totalCents: 5000, dueAt: '2026-08-01T00:00:00.000Z' })
    const draft = invoice({ id: 'i3', status: 'draft', totalCents: 999999, issuedAt: null, dueAt: null })
    const voided = invoice({ id: 'i4', status: 'void', totalCents: 888888 })
    const payments: PaymentsByInvoice = { i2: [payment({ invoiceId: 'i2', amountCents: 5000 })] }
    const today = '2026-08-28'

    const summary = summarise([sentOverdue, paidInFull, draft, voided], payments, today)

    expect(summary.count).toBe(4)
    expect(summary.billed).toBe(15000)
    expect(summary.received).toBe(5000)
    expect(summary.outstanding).toBe(10000)
    expect(summary.openCount).toBe(1)
    expect(summary.overdueCount).toBe(1)
    expect(summary.overdueAmount).toBe(10000)
  })
})

describe('averageDaysToPay', () => {
  it('averages whole days from issue to the last payment, over settled invoices only', () => {
    const first = invoice({ id: 'i1', status: 'paid', issuedAt: '2026-08-01T00:00:00.000Z' })
    const second = invoice({ id: 'i2', status: 'paid', issuedAt: '2026-08-10T00:00:00.000Z' })
    const notPaid = invoice({ id: 'i3', status: 'sent', issuedAt: '2026-08-01T00:00:00.000Z' })
    const payments: PaymentsByInvoice = {
      i1: [payment({ invoiceId: 'i1', paidAt: '2026-08-05T00:00:00.000Z' })],
      i2: [payment({ invoiceId: 'i2', paidAt: '2026-08-16T00:00:00.000Z' })]
    }

    expect(averageDaysToPay([first, second, notPaid], payments)).toBe(5)
  })

  it('is null when nothing has settled', () => {
    const open = invoice({ id: 'i1', status: 'sent' })
    expect(averageDaysToPay([open], {})).toBeNull()
  })
})

describe('the create-invoice draft model', () => {
  it('lineFromProject copies the project onto a fresh draft line', () => {
    const p = project({ id: 'p1', name: 'Project One', priceCents: 250000 })
    const draft = lineFromProject(p)
    expect(draft.label).toBe('Project One')
    expect(draft.amountCents).toBe(250000)
    expect(draft.projectId).toBe('p1')
    expect(typeof draft.id).toBe('string')
    expect(draft.id.length).toBeGreaterThan(0)
  })

  it('newLine starts a hand-typed line at zero with no project', () => {
    const draft = newLine('Custom line')
    expect(draft.label).toBe('Custom line')
    expect(draft.amountCents).toBe(0)
    expect(draft.projectId).toBeNull()
  })

  it('draftSubtotal sums the draft lines', () => {
    expect(draftSubtotal([newLine('A'), { ...newLine('B'), amountCents: 500 }])).toBe(500)
  })
})
