import { describe, expect, it } from 'vitest'
import {
  invoiceSequenceOf,
  nextInvoiceNumber,
  nextInvoiceSequence,
  schemeHasCounter
} from './invoice-number'

/* The app's fixed day: a Friday in August 2026. Both the year and the month
   contain a zero, which is exactly what a naive generator trips over. */
const AT = '2026-08-28T09:15:00.000Z'

describe('schemeHasCounter', () => {
  it('needs a run of zeros', () => {
    expect(schemeHasCounter('INV-0000')).toBe(true)
    expect(schemeHasCounter('{YYYY}-0')).toBe(true)
    expect(schemeHasCounter('INV')).toBe(false)
    expect(schemeHasCounter('INV-{YYYY}')).toBe(false)
    expect(schemeHasCounter('')).toBe(false)
  })
})

describe('nextInvoiceNumber', () => {
  it('follows INV-0149 with INV-0150', () => {
    expect(nextInvoiceNumber('INV-0000', 150, AT)).toBe('INV-0150')
  })

  it('lets the run of zeros set the width, and grows past it', () => {
    expect(nextInvoiceNumber('INV-000000', 150, AT)).toBe('INV-000150')
    expect(nextInvoiceNumber('INV-00', 150, AT)).toBe('INV-150')
    expect(nextInvoiceNumber('INV-0', 7, AT)).toBe('INV-7')
  })

  it('fills the date tokens from the issue date', () => {
    expect(nextInvoiceNumber('{YYYY}-0000', 150, AT)).toBe('2026-0150')
    expect(nextInvoiceNumber('{YY}{MM}-000', 150, AT)).toBe('2608-150')
    expect(nextInvoiceNumber('INV/{YYYY}/{MM}/000', 3, AT)).toBe('INV/2026/08/003')
  })

  it('does not mistake the zeros in a year or a month for the counter', () => {
    /* 2026 has a zero, 08 has a zero; the counter is still the trailing run. */
    expect(nextInvoiceNumber('{YYYY}{MM}0000', 150, AT)).toBe('202608' + '0150')
    expect(nextInvoiceNumber('{MM}-{YYYY}-00', 1, AT)).toBe('08-2026-01')
  })

  it('takes the tokens after the counter too', () => {
    expect(nextInvoiceNumber('000-{YY}', 150, AT)).toBe('150-26')
  })

  it('reads the month in UTC, like every other date', () => {
    expect(nextInvoiceNumber('{YYYY}{MM}-000', 1, '2026-01-01T00:30:00.000Z')).toBe('202601-001')
    expect(nextInvoiceNumber('{YYYY}{MM}-000', 1, new Date(Date.UTC(2026, 11, 31, 23, 59)))).toBe(
      '202612-001'
    )
  })

  it('is null when the scheme cannot count', () => {
    expect(nextInvoiceNumber('INV', 150, AT)).toBeNull()
    expect(nextInvoiceNumber('', 150, AT)).toBeNull()
  })

  it('never produces a negative or fractional counter', () => {
    expect(nextInvoiceNumber('INV-0000', 0, AT)).toBe('INV-0000')
    expect(nextInvoiceNumber('INV-0000', -3, AT)).toBe('INV-0000')
    expect(nextInvoiceNumber('INV-0000', 12.9, AT)).toBe('INV-0012')
  })
})

describe('invoiceSequenceOf', () => {
  it('reads the counter back out of a number', () => {
    expect(invoiceSequenceOf('INV-0150', 'INV-0000')).toBe(150)
    expect(invoiceSequenceOf('INV-150', 'INV-00')).toBe(150)
    expect(invoiceSequenceOf('2026-0150', '{YYYY}-0000')).toBe(150)
    expect(invoiceSequenceOf('2608-150', '{YY}{MM}-000')).toBe(150)
  })

  it('reads by position, so the year is never taken for the counter', () => {
    expect(invoiceSequenceOf('2026080150', '{YYYY}{MM}0000')).toBe(150)
  })

  it('is null for a number from another scheme', () => {
    expect(invoiceSequenceOf('INV-0150', '{YYYY}-0000')).toBeNull()
    expect(invoiceSequenceOf('2026-0150', 'INV-0000')).toBeNull()
    expect(invoiceSequenceOf('draft', 'INV-0000')).toBeNull()
    expect(invoiceSequenceOf('INV-0150', 'INV')).toBeNull()
  })

  it('treats the literal parts of a scheme literally', () => {
    expect(invoiceSequenceOf('A.B-001', 'A.B-000')).toBe(1)
    expect(invoiceSequenceOf('AXB-001', 'A.B-000')).toBeNull()
    expect(invoiceSequenceOf('(2026) 001', '({YYYY}) 000')).toBe(1)
  })

  it('round-trips what nextInvoiceNumber produces', () => {
    for (const scheme of ['INV-0000', '{YYYY}-0000', '{YY}{MM}-000', 'INV/{YYYY}/{MM}/000']) {
      const number = nextInvoiceNumber(scheme, 150, AT)
      expect(number).not.toBeNull()
      expect(invoiceSequenceOf(number as string, scheme)).toBe(150)
    }
  })
})

describe('nextInvoiceSequence', () => {
  it('is one past the highest counter in the register', () => {
    expect(nextInvoiceSequence(['INV-0149', 'INV-0131', 'INV-0104'], 'INV-0000')).toBe(150)
  })

  it('ignores numbers from another scheme and starts at one with none', () => {
    expect(nextInvoiceSequence(['2026-0150', 'INV-0149'], 'INV-0000')).toBe(150)
    expect(nextInvoiceSequence(['2026-0150'], 'INV-0000')).toBe(1)
    expect(nextInvoiceSequence([], 'INV-0000')).toBe(1)
  })

  it('does not depend on the order of the register', () => {
    expect(nextInvoiceSequence(['INV-0104', 'INV-0149', 'INV-0131'], 'INV-0000')).toBe(150)
  })
})
