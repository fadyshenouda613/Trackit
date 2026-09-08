import { describe, expect, it } from 'vitest'
import type { Settings } from '@trackit/shared'
import { formFrom, parseRateFloor, parseScheme, parseTaxRate, parseTermDays } from './settings-data'

describe('parseTaxRate', () => {
  it('accepts a per cent from 0 to 100', () => {
    expect(parseTaxRate('0')).toBe(0)
    expect(parseTaxRate('8.5')).toBe(8.5)
    expect(parseTaxRate('100')).toBe(100)
  })

  it('rejects out-of-range, empty and unreadable text', () => {
    expect(parseTaxRate('101')).toBeNull()
    expect(parseTaxRate('-1')).toBeNull()
    expect(parseTaxRate('')).toBeNull()
    expect(parseTaxRate('abc')).toBeNull()
  })
})

describe('parseTermDays', () => {
  it('accepts a whole number of days, trimmed', () => {
    expect(parseTermDays('0')).toBe(0)
    expect(parseTermDays('14')).toBe(14)
    expect(parseTermDays(' 30 ')).toBe(30)
  })

  it('rejects a negative, fractional or empty value', () => {
    expect(parseTermDays('-1')).toBeNull()
    expect(parseTermDays('1.5')).toBeNull()
    expect(parseTermDays('')).toBeNull()
  })
})

describe('parseRateFloor', () => {
  it('reads a typed figure back as non-negative cents', () => {
    expect(parseRateFloor('300.00')).toBe(30000)
    expect(parseRateFloor('$1,250.50')).toBe(125050)
  })

  it('rejects a negative, unreadable or empty value', () => {
    expect(parseRateFloor('-5')).toBeNull()
    expect(parseRateFloor('abc')).toBeNull()
    expect(parseRateFloor('')).toBeNull()
  })
})

describe('parseScheme', () => {
  it('returns the trimmed scheme when it has a counter', () => {
    expect(parseScheme('INV-0000')).toBe('INV-0000')
    expect(parseScheme(' 2026-000 ')).toBe('2026-000')
  })

  it('returns null for a scheme with no run of zeros, or none at all', () => {
    expect(parseScheme('ABC')).toBeNull()
    expect(parseScheme('')).toBeNull()
  })
})

describe('formFrom', () => {
  it('renders the four settings figures as the typed text a form field holds', () => {
    const settings: Settings = {
      person: 'Alex Marchetti',
      businessName: 'Trackit Studio',
      address: '2130 Fillmore Street, Studio 4\nSan Francisco, CA 94115',
      email: 'billing@trackit.studio',
      phone: '',
      logo: null,
      currency: 'USD',
      taxRate: 8.5,
      paymentTermsDays: 14,
      numberingScheme: 'INV-0000',
      rateFloorCents: 30000,
      shortcut: 'CommandOrControl+Shift+S',
      theme: 'system',
      accountEmail: 'alex@trackit.studio',
      updatedAt: '2026-01-01T00:00:00.000Z',
      syncState: 'pending'
    }

    expect(formFrom(settings)).toEqual({
      taxRate: '8.5',
      paymentTermsDays: '14',
      rateFloor: '300.00',
      numberingScheme: 'INV-0000'
    })
  })
})
