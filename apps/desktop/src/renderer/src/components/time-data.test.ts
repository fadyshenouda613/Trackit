import { describe, expect, it } from 'vitest'
import { clockSpanMinutes, entryMinutes, type TimeEntry } from '@trackit/shared'
import { atLocal, localDateOf, localMinutesOf } from './local-dates'
import {
  clockOf,
  dayLabel,
  dayOf,
  daysOf,
  formatDelta,
  weekRangeLabel,
  weekStartFor,
  weekWindow
} from './time-data'

// A fixed "today" so the week arithmetic is not at the mercy of the clock.
const TODAY = '2026-09-08' // Tuesday

describe('weekWindow', () => {
  it('starts the current week on Monday', () => {
    const week = weekWindow(0, TODAY)
    expect(week.start).toBe('2026-09-07')
  })

  it('spans a whole week as UTC ISO, from before to', () => {
    const week = weekWindow(0, TODAY)
    expect(week.to > week.from).toBe(true)
  })
})

describe('daysOf', () => {
  it('stops the current week at today, newest first', () => {
    const week = weekWindow(0, TODAY)
    expect(daysOf(week, TODAY)).toEqual(['2026-09-08', '2026-09-07'])
  })

  it('lists all seven days of a past week, newest first', () => {
    const week = weekWindow(-1, TODAY)
    expect(daysOf(week, TODAY)).toEqual([
      '2026-09-06',
      '2026-09-05',
      '2026-09-04',
      '2026-09-03',
      '2026-09-02',
      '2026-09-01',
      '2026-08-31'
    ])
  })
})

describe('dayLabel', () => {
  it('names today', () => {
    expect(dayLabel(TODAY, TODAY)).toEqual({ primary: 'Today', secondary: '8 September' })
  })

  it('names yesterday', () => {
    expect(dayLabel('2026-09-07', TODAY)).toEqual({ primary: 'Yesterday', secondary: '7 September' })
  })

  it('names any other day by its weekday', () => {
    expect(dayLabel('2026-09-03', TODAY)).toEqual({ primary: 'Thursday', secondary: '3 September' })
  })

  it('names yesterday across the turn of a month and of a year', () => {
    expect(dayLabel('2026-09-30', '2026-10-01')).toEqual({ primary: 'Yesterday', secondary: '30 September' })
    expect(dayLabel('2026-12-31', '2027-01-01')).toEqual({ primary: 'Yesterday', secondary: '31 December' })
  })
})

describe('weekStartFor at the week boundaries', () => {
  it('puts a Sunday in the week that began the Monday before, not the one after', () => {
    expect(weekStartFor(0, '2026-09-13')).toBe('2026-09-07')
  })

  it('is a Monday\'s own day, and steps by whole weeks from it', () => {
    expect(weekStartFor(0, '2026-09-07')).toBe('2026-09-07')
    expect(weekStartFor(-1, '2026-09-07')).toBe('2026-08-31')
    expect(weekStartFor(1, '2026-09-07')).toBe('2026-09-14')
  })

  it('reaches back across the year for a January that starts mid-week', () => {
    expect(weekStartFor(0, '2027-01-01')).toBe('2026-12-28')
  })
})

/*
 * The window is built from local midnights, so its UTC edges depend on the
 * zone this runs in. These hold in any zone: they go through the local-time
 * pair rather than naming a UTC string.
 */
describe('weekWindow edges', () => {
  it('shares its edge with the next week: no gap and no overlap', () => {
    expect(weekWindow(1, TODAY).from).toBe(weekWindow(0, TODAY).to)
  })

  it('starts and ends at local midnight on a Monday', () => {
    const week = weekWindow(0, TODAY)
    expect(localDateOf(week.from)).toBe('2026-09-07')
    expect(localMinutesOf(week.from)).toBe(0)
    expect(localDateOf(week.to)).toBe('2026-09-14')
    expect(localMinutesOf(week.to)).toBe(0)
  })

  it('is seven local days long all year: 168 hours, except the DST weeks at 167 or 169', () => {
    /* 2026-12-28 is a Monday; offsets -52..0 cover every week of 2026. */
    const hours = Array.from({ length: 53 }, (_, i) => {
      const week = weekWindow(i - 52, '2026-12-28')
      return (Date.parse(week.to) - Date.parse(week.from)) / 3_600_000
    })
    for (const week of hours) expect([167, 168, 169]).toContain(week)
    expect(hours.filter((week) => week !== 168).length).toBeLessThanOrEqual(2)
    expect(hours.reduce((sum, week) => sum + week, 0)).toBe(53 * 168)
  })
})

describe('daysOf at the week edges', () => {
  it('is a single day on a Monday', () => {
    expect(daysOf(weekWindow(0, '2026-09-07'), '2026-09-07')).toEqual(['2026-09-07'])
  })

  it('is the whole week on a Sunday, newest first', () => {
    const days = daysOf(weekWindow(0, '2026-09-13'), '2026-09-13')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-09-13')
    expect(days[6]).toBe('2026-09-07')
  })
})

describe('dayOf', () => {
  const entry = (startedAt: string, endedAt: string): TimeEntry => ({
    id: '00000000-0000-4000-8000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000002',
    checklistItemId: null,
    note: '',
    startedAt,
    endedAt,
    source: 'manual',
    createdAt: startedAt,
    updatedAt: startedAt,
    deletedAt: null,
    syncState: 'synced'
  })

  it('files an entry that runs past local midnight under the day it started', () => {
    const late = entry(atLocal(TODAY, 23 * 60 + 30), atLocal(TODAY, 24 * 60 + 30))
    expect(dayOf(late)).toBe(TODAY)
    expect(localDateOf(late.endedAt ?? '')).toBe('2026-09-09')
    expect(entryMinutes(late)).toBe(60)
    /* And the clock-time wrap the row draws agrees with the UTC arithmetic. */
    expect(clockSpanMinutes(localMinutesOf(late.startedAt), localMinutesOf(late.endedAt ?? ''))).toBe(60)
  })
})

describe('weekRangeLabel', () => {
  it('collapses the month when both ends share it, and names both when they do not', () => {
    expect(weekRangeLabel('2026-08-24')).toBe('24–30 Aug 2026')
    expect(weekRangeLabel('2026-08-31')).toBe('31 Aug – 6 Sep 2026')
  })

  it('names only the year the week ends in when it straddles two', () => {
    expect(weekRangeLabel('2026-12-28')).toBe('28 Dec – 3 Jan 2027')
  })
})

describe('formatDelta', () => {
  it('has no comparison without last week, and says which way otherwise', () => {
    expect(formatDelta(300, 0)).toBe('No entries last week')
    expect(formatDelta(300, 300)).toBe('Same as last week')
    expect(formatDelta(345, 300)).toBe('▲ 45m vs last week')
    expect(formatDelta(180, 300)).toBe('▼ 2h 00m vs last week')
    expect(formatDelta(0, 300)).toBe('▼ 5h 00m vs last week')
  })
})

describe('clockOf', () => {
  it('prints the local wall clock, padded, in 24-hour form', () => {
    expect(clockOf(new Date(2026, 8, 8, 9, 5).getTime())).toBe('09:05')
    expect(clockOf(new Date(2026, 8, 8, 0, 0).getTime())).toBe('00:00')
    expect(clockOf(new Date(2026, 8, 8, 23, 59).getTime())).toBe('23:59')
  })
})
