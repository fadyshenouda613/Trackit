import { describe, expect, it } from 'vitest'
import { dayLabel, daysOf, weekWindow } from './time-data'

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
})
