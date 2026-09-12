import { describe, expect, it } from 'vitest'
import {
  balanceCents,
  dueDateOf,
  invoiceStatusOf,
  invoiceTotals,
  overdueDays,
  overdueJudgement,
  paidCents,
  subtotalCents,
  taxCents
} from './invoice-math'

const TODAY = '2026-08-28'

describe('totals', () => {
  it('sums the lines', () => {
    expect(subtotalCents([{ amountCents: 260000 }, { amountCents: 190000 }, { amountCents: 150000 }])).toBe(600000)
    expect(subtotalCents([])).toBe(0)
  })

  it('takes tax as a per cent, to the nearest cent', () => {
    /* INV-0104: $6,000.00 at 20% is the $7,200.00 the client detail states. */
    expect(taxCents(600000, 20)).toBe(120000)
    /* The printed specimen: $9,250.00 at 8.5%. */
    expect(taxCents(925000, 8.5)).toBe(78625)
    expect(taxCents(1001, 8.5)).toBe(85)
    expect(taxCents(600000, 0)).toBe(0)
  })

  it('rounds half up, and on the subtotal rather than line by line', () => {
    /* 12.5 cents goes to 13, not to the even 12. */
    expect(taxCents(125, 10)).toBe(13)
    expect(taxCents(115, 10)).toBe(12)
    expect(taxCents(1, 50)).toBe(1)
    /* Three lines of a cent at 50%: 1.5 on the subtotal is 2; line by line it would be 3. */
    expect(invoiceTotals([{ amountCents: 1 }, { amountCents: 1 }, { amountCents: 1 }], 50)).toEqual({
      subtotalCents: 3,
      taxCents: 2,
      totalCents: 5
    })
  })

  it('is not moved by a rate floating point cannot hold exactly', () => {
    expect(taxCents(100, 7.1)).toBe(7)
    expect(taxCents(1000, 8.5)).toBe(85)
    expect(taxCents(3, 33.3)).toBe(1)
    expect(taxCents(100_000_000, 100)).toBe(100_000_000)
  })

  it('snapshots the three figures together', () => {
    expect(invoiceTotals([{ amountCents: 600000 }], 20)).toEqual({
      subtotalCents: 600000,
      taxCents: 120000,
      totalCents: 720000
    })
  })

  it('reads the balance off the payments', () => {
    expect(paidCents([{ amountCents: 500000 }, { amountCents: 300000 }])).toBe(800000)
    expect(balanceCents(900000, 800000)).toBe(100000)
    expect(balanceCents(900000, 950000)).toBe(-50000)
  })
})

describe('invoiceStatusOf', () => {
  const sent = { voided: false, issued: true, totalCents: 320000, paidCents: 0 }

  it('reads the five states off the facts', () => {
    expect(invoiceStatusOf(sent)).toBe('sent')
    expect(invoiceStatusOf({ ...sent, paidCents: 221000 })).toBe('partial')
    expect(invoiceStatusOf({ ...sent, paidCents: 320000 })).toBe('paid')
    expect(invoiceStatusOf({ ...sent, issued: false })).toBe('draft')
    expect(invoiceStatusOf({ ...sent, voided: true })).toBe('void')
  })

  it('counts an overpayment as paid, and void beats everything', () => {
    expect(invoiceStatusOf({ ...sent, paidCents: 330000 })).toBe('paid')
    expect(invoiceStatusOf({ ...sent, voided: true, issued: false, paidCents: 320000 })).toBe('void')
  })

  it('treats a zero-total issued invoice as paid, not sent', () => {
    expect(invoiceStatusOf({ ...sent, totalCents: 0 })).toBe('paid')
  })
})

describe('dueDateOf', () => {
  it('is the issue date plus the terms, as a date', () => {
    expect(dueDateOf('2026-08-24T00:00:00.000Z', 14)).toBe('2026-09-07')
    expect(dueDateOf('2026-08-22', 0)).toBe('2026-08-22')
    expect(dueDateOf('2026-12-25T00:00:00.000Z', 14)).toBe('2027-01-08')
  })
})

describe('overdueDays', () => {
  it('reads "24 days overdue" and "6 days" off the attention list', () => {
    expect(overdueDays('2026-08-04', TODAY)).toBe(24)
    expect(overdueDays('2026-08-22', TODAY)).toBe(6)
    expect(overdueDays('2026-08-27', TODAY)).toBe(1)
  })

  it('is null on the due date, before it, and with no due date', () => {
    expect(overdueDays(TODAY, TODAY)).toBeNull()
    expect(overdueDays('2026-09-07', TODAY)).toBeNull()
    expect(overdueDays(null, TODAY)).toBeNull()
  })

  it('accepts timestamps for either side', () => {
    expect(overdueDays('2026-08-04T09:00:00.000Z', '2026-08-28T23:00:00.000Z')).toBe(24)
  })
})

describe('overdueJudgement', () => {
  it('is a slow payer for a fortnight and a collection past it', () => {
    expect(overdueJudgement(6)).toBe('warning')
    expect(overdueJudgement(14)).toBe('warning')
    expect(overdueJudgement(15)).toBe('negative')
    expect(overdueJudgement(24)).toBe('negative')
  })
})
