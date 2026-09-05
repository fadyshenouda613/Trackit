import { describe, expect, it } from 'vitest'
import type { Client, Invoice, Project } from '@trackit/shared'
import { byOutstanding, clientRow, clientTotals, hoursLabel, type ClientRow, type PaymentsByInvoice } from './client-rows'

const BASE = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, syncState: 'pending' as const }

const client = (over: Partial<Client> = {}): Client => ({
  ...BASE,
  id: 'c1',
  name: 'Jane Doe',
  company: 'Acme Co',
  email: 'jane@acme.com',
  phone: '555-1234',
  address: '123 Main St',
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

const project = (over: Partial<Project> = {}): Project => ({
  ...BASE,
  id: 'p1',
  clientId: 'c1',
  name: 'Project 1',
  description: '',
  priceCents: 100000,
  currency: 'USD',
  budgetedHours: 40,
  status: 'active',
  kickoffAt: '2026-01-01T00:00:00.000Z',
  dueAt: null,
  deliveredAt: null,
  ...over
})

describe('clientRow', () => {
  it('sums outstanding and flags the latest overdue days from a sent invoice 20 days past due', () => {
    const c = client()
    const inv = invoice({ dueAt: '2026-08-08T00:00:00.000Z', totalCents: 100000, status: 'sent' })
    const payments: PaymentsByInvoice = {}
    const today = '2026-08-28'

    const row = clientRow(c, [], [inv], payments, today)

    expect(row.lifetimeCents).toBe(100000)
    expect(row.lifetime).toBe('$1,000.00')
    expect(row.outstandingCents).toBe(100000)
    expect(row.outstanding).toBe('$1,000.00')
    expect(row.late).toBe('20d late')
  })

  it('takes the worst of several overdue invoices and excludes drafts and voids from the totals', () => {
    const c = client()
    const sentLate = invoice({ id: 'i1', dueAt: '2026-08-08T00:00:00.000Z', totalCents: 50000, status: 'sent' })
    const sentLater = invoice({ id: 'i2', dueAt: '2026-08-01T00:00:00.000Z', totalCents: 20000, status: 'sent' })
    const draft = invoice({ id: 'i3', status: 'draft', totalCents: 999999, issuedAt: null, dueAt: null })
    const voided = invoice({ id: 'i4', status: 'void', totalCents: 999999 })
    const today = '2026-08-28'

    const row = clientRow(c, [], [sentLate, sentLater, draft, voided], {}, today)

    expect(row.lifetimeCents).toBe(70000)
    expect(row.late).toBe('27d late')
  })

  it('has no late marker when nothing open is overdue', () => {
    const c = client()
    const row = clientRow(c, [], [invoice({ status: 'paid', dueAt: '2026-08-08T00:00:00.000Z' })], {}, '2026-08-28')
    expect(row.late).toBeUndefined()
  })

  it('counts only active projects for that client', () => {
    const c = client({ id: 'c1' })
    const mine = project({ id: 'p1', clientId: 'c1', status: 'active' })
    const someoneElses = project({ id: 'p2', clientId: 'c2', status: 'active' })
    const mineButDraft = project({ id: 'p3', clientId: 'c1', status: 'draft' })
    const row = clientRow(c, [mine, someoneElses, mineButDraft], [], {}, '2026-08-28')
    expect(row.activeProjects).toBe('1')
  })
})

describe('byOutstanding', () => {
  it('sorts most owed first, then most billed as a tiebreak', () => {
    const rows: ClientRow[] = [
      { id: 'a', initials: 'A', name: 'A', company: 'A', activeProjects: '0', lifetime: '', lifetimeCents: 5000, outstanding: '', outstandingCents: 1000 },
      { id: 'b', initials: 'B', name: 'B', company: 'B', activeProjects: '0', lifetime: '', lifetimeCents: 9000, outstanding: '', outstandingCents: 3000 },
      { id: 'c', initials: 'C', name: 'C', company: 'C', activeProjects: '0', lifetime: '', lifetimeCents: 8000, outstanding: '', outstandingCents: 3000 }
    ]
    const sorted = [...rows].sort(byOutstanding)
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('clientTotals', () => {
  it('sums lifetime and outstanding cents across rows', () => {
    const rows: ClientRow[] = [
      { id: 'a', initials: 'A', name: 'A', company: 'A', activeProjects: '2', lifetime: '', lifetimeCents: 5000, outstanding: '', outstandingCents: 1000 },
      { id: 'b', initials: 'B', name: 'B', company: 'B', activeProjects: '1', lifetime: '', lifetimeCents: 9000, outstanding: '', outstandingCents: 3000 }
    ]
    const totals = clientTotals(rows, '$')
    expect(totals.count).toBe(2)
    expect(totals.active).toBe(3)
    expect(totals.lifetime).toBe('$140.00')
    expect(totals.outstanding).toBe('$40.00')
  })
})

describe('hoursLabel', () => {
  it('prints "0h 00m" rather than an em dash for zero minutes', () => {
    expect(hoursLabel(0)).toBe('0h 00m')
  })

  it('otherwise defers to formatDuration', () => {
    expect(hoursLabel(65)).toBe('1h 05m')
  })
})
