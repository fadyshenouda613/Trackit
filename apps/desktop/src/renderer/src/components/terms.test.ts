import { describe, expect, it } from 'vitest'
import { plural, termsLabel } from './terms'

describe('plural', () => {
  it('drops the s at one, and only at one', () => {
    expect(plural(1, 'invoice')).toBe('1 invoice')
    expect(plural(0, 'invoice')).toBe('0 invoices')
    expect(plural(2, 'invoice')).toBe('2 invoices')
  })

  it('takes an irregular plural when the s is wrong', () => {
    expect(plural(1, 'entry', 'entries')).toBe('1 entry')
    expect(plural(3, 'entry', 'entries')).toBe('3 entries')
  })
})

describe('termsLabel', () => {
  it('names the receipt case rather than calling it net zero', () => {
    expect(termsLabel(0)).toBe('Due on receipt')
    expect(termsLabel(14)).toBe('Net 14')
  })
})
