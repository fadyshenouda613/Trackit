import { describe, expect, it } from 'vitest'
import { formatCents, formatMoney, parseMoney, parseMoneyToCents, toCents } from './money'

describe('formatMoney', () => {
  it('always shows two decimals with grouping', () => {
    expect(formatMoney(1200)).toBe('$1,200.00')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(230.094)).toBe('$230.09')
  })

  it('takes the symbol the client is billed in', () => {
    expect(formatMoney(1234.5, '£')).toBe('£1,234.50')
    expect(formatMoney(6500, '')).toBe('6,500.00')
  })

  it('puts the sign ahead of the symbol', () => {
    expect(formatMoney(-5)).toBe('-$5.00')
  })
})

describe('formatCents', () => {
  it('formats stored cents', () => {
    expect(formatCents(650000)).toBe('$6,500.00')
    expect(formatCents(23009)).toBe('$230.09')
    expect(formatCents(-150, '€')).toBe('-€1.50')
  })
})

describe('parseMoney', () => {
  it('reads back what a field is typed with', () => {
    expect(parseMoney('$12,000.00')).toBe(12000)
    expect(parseMoney('£1,234.5')).toBe(1234.5)
    expect(parseMoney('  450 ')).toBe(450)
  })

  it('is null for nothing and for nonsense', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('$')).toBeNull()
    expect(parseMoney('twelve')).toBeNull()
  })

  it('keeps a sign, strips any of the symbols, and refuses a second point', () => {
    expect(parseMoney('-$5.00')).toBe(-5)
    expect(parseMoney('£ 1,234.56')).toBe(1234.56)
    expect(parseMoney('€1 200')).toBe(1200)
    expect(parseMoney('1.2.3')).toBeNull()
  })
})

describe('toCents / parseMoneyToCents', () => {
  it('rounds a major-unit figure to whole cents', () => {
    expect(toCents(6500)).toBe(650000)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(1.005)).toBe(100)
  })

  it('reads a typed figure straight into cents', () => {
    expect(parseMoneyToCents('1,200.50')).toBe(120050)
    expect(parseMoneyToCents('')).toBeNull()
  })

  it('reads back exactly what formatCents printed', () => {
    for (const cents of [0, 1, 99, 100, 123456789, -250]) {
      expect(parseMoneyToCents(formatCents(cents))).toBe(cents)
    }
  })
})
