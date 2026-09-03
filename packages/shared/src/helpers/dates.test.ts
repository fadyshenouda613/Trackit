import { describe, expect, it } from 'vitest'
import { addDays, dateOf, daysBetween, shortDate } from './dates'

describe('dateOf', () => {
  it('keeps the date part of a date or a timestamp', () => {
    expect(dateOf('2026-08-28')).toBe('2026-08-28')
    expect(dateOf('2026-08-28T23:59:00.000Z')).toBe('2026-08-28')
  })
})

describe('addDays', () => {
  it('crosses months and years, in either direction', () => {
    expect(addDays('2026-08-28', 14)).toBe('2026-09-11')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-08-28', 0)).toBe('2026-08-28')
  })

  it('accepts a timestamp and answers with a date', () => {
    expect(addDays('2026-08-24T10:00:00.000Z', 14)).toBe('2026-09-07')
  })
})

describe('daysBetween', () => {
  it('is whole days, negative when the second is earlier', () => {
    /* INV-0142: issued 28 Jul on Net 7, so due 4 Aug; 24 days late on 28 Aug. */
    expect(daysBetween('2026-08-04', '2026-08-28')).toBe(24)
    expect(daysBetween('2026-08-28', '2026-08-27')).toBe(-1)
    expect(daysBetween('2026-08-28', '2026-08-28')).toBe(0)
  })
})

describe('shortDate', () => {
  it('pads the day so the column lines up', () => {
    expect(shortDate('2026-07-02')).toBe('02 Jul 2026')
    expect(shortDate('2026-08-26')).toBe('26 Aug 2026')
  })

  it('reads the date part of a timestamp in UTC', () => {
    expect(shortDate('2026-08-28T23:59:00.000Z')).toBe('28 Aug 2026')
  })
})
