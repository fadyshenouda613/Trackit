import { describe, expect, it } from 'vitest'
import { atLocal, dateLabel, localDateOf, localMinutesOf, parseShortDate, todayIso } from './local-dates'

/*
 * The local-time edge. Everything stored is UTC; everything on a day grid is
 * local, and these four functions are the only place the two meet. So the
 * tests are written to hold in any timezone: they go through the pair rather
 * than asserting a particular UTC string, because the string is whatever the
 * machine running this happens to be.
 */

const DAY = '2026-09-08'

describe('atLocal and localMinutesOf', () => {
  it('round-trips minutes since local midnight', () => {
    for (const minutes of [0, 1, 540, 1439]) {
      expect(localMinutesOf(atLocal(DAY, minutes))).toBe(minutes)
    }
  })

  it('keeps midday on the day it was asked for', () => {
    expect(localDateOf(atLocal(DAY, 720))).toBe(DAY)
  })

  /* What TimeLog does with an entry that runs past midnight: it adds 1440 to
     the end rather than naming the next day, and the wrap has to land on it. */
  it('wraps past midnight onto the next local day', () => {
    const wrapped = atLocal(DAY, 1440 + 30)
    expect(localDateOf(wrapped)).toBe('2026-09-09')
    expect(localMinutesOf(wrapped)).toBe(30)
  })
})

describe('parseShortDate', () => {
  it('reads the three shapes a date field is typed in', () => {
    expect(parseShortDate('08 Sep 2026')).toBe('2026-09-08')
    expect(parseShortDate('8 Sep 2026')).toBe('2026-09-08')
    expect(parseShortDate('2026-09-08')).toBe('2026-09-08')
  })

  it('returns null for text that is not a date', () => {
    expect(parseShortDate('yesterday')).toBeNull()
  })

  /*
   * Current behaviour, asserted rather than corrected: the parser checks the
   * shape of a date and not the length of the month, so "32 Sep 2026" comes
   * back as a well-formed day that does not exist. Whatever consumes it is
   * what rejects it. Changing that is a change to the field, not to a test.
   */
  it('does not check that the day is inside its month', () => {
    expect(parseShortDate('32 Sep 2026')).toBe('2026-09-32')
  })
})

describe('dateLabel', () => {
  it('prints an em dash for nothing', () => {
    expect(dateLabel(null)).toBe('—')
  })
})

describe('todayIso', () => {
  it('names the local calendar day, not the UTC one', () => {
    expect(todayIso(new Date(2026, 8, 8, 12))).toBe('2026-09-08')
  })
})
