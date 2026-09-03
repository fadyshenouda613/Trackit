import { describe, expect, it } from 'vitest'
import {
  clockSpanMinutes,
  entryMinutes,
  formatBudget,
  formatClock,
  formatDuration,
  hoursToMinutes,
  parseClock,
  totalMinutes
} from './duration'

describe('formatDuration', () => {
  it('is an em dash with nothing to show', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(-5)).toBe('—')
  })

  it('drops the hours under one and pads the minutes past it', () => {
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(60)).toBe('1h 00m')
    expect(formatDuration(1695)).toBe('28h 15m')
  })
})

describe('formatBudget', () => {
  it('reads whole hours as a budget, anything else as a measurement', () => {
    expect(formatBudget(1920)).toBe('32h')
    expect(formatBudget(1950)).toBe('32h 30m')
    expect(formatBudget(0)).toBe('—')
  })
})

describe('formatClock', () => {
  it('is twelve-hour with the noon and midnight edges right', () => {
    expect(formatClock(570)).toBe('9:30 AM')
    expect(formatClock(0)).toBe('12:00 AM')
    expect(formatClock(720)).toBe('12:00 PM')
    expect(formatClock(765)).toBe('12:45 PM')
    expect(formatClock(1439)).toBe('11:59 PM')
  })
})

describe('parseClock', () => {
  it('lands however a time is typed', () => {
    expect(parseClock('9:15am')).toBe(555)
    expect(parseClock('0915')).toBe(555)
    expect(parseClock('9 15 PM')).toBe(21 * 60 + 15)
    expect(parseClock('14:00')).toBe(840)
    expect(parseClock('12am')).toBe(0)
    expect(parseClock('12 pm')).toBe(720)
    expect(parseClock('6.00 p.m.')).toBe(18 * 60)
  })

  it('is null when it cannot tell', () => {
    expect(parseClock('')).toBeNull()
    expect(parseClock('25:00')).toBeNull()
    expect(parseClock('13pm')).toBeNull()
    expect(parseClock('9:75')).toBeNull()
    expect(parseClock('noon')).toBeNull()
  })
})

describe('clockSpanMinutes', () => {
  it('measures within a day and wraps past midnight', () => {
    expect(clockSpanMinutes(570, 765)).toBe(195)
    expect(clockSpanMinutes(970, 120)).toBe(590)
    expect(clockSpanMinutes(500, 500)).toBe(0)
  })
})

describe('hoursToMinutes', () => {
  it('rounds to whole minutes', () => {
    expect(hoursToMinutes(32)).toBe(1920)
    expect(hoursToMinutes(0.5)).toBe(30)
    expect(hoursToMinutes(1 / 3)).toBe(20)
  })
})

describe('entryMinutes', () => {
  const started = '2026-08-28T09:30:00.000Z'

  it('is the whole minutes between the two ends', () => {
    expect(entryMinutes({ startedAt: started, endedAt: '2026-08-28T12:45:00.000Z' })).toBe(195)
    expect(entryMinutes({ startedAt: started, endedAt: '2026-08-28T12:45:59.000Z' })).toBe(195)
  })

  it('measures a running entry up to the now it is handed', () => {
    expect(entryMinutes({ startedAt: started, endedAt: null }, '2026-08-28T10:00:00.000Z')).toBe(30)
  })

  it('never goes negative and treats an unreadable time as nothing', () => {
    expect(entryMinutes({ startedAt: started, endedAt: '2026-08-28T09:00:00.000Z' })).toBe(0)
    expect(entryMinutes({ startedAt: 'yesterday', endedAt: started })).toBe(0)
  })
})

describe('totalMinutes', () => {
  it('sums a list, sharing one now across the running rows', () => {
    const entries = [
      { startedAt: '2026-08-28T09:30:00.000Z', endedAt: '2026-08-28T12:45:00.000Z' },
      { startedAt: '2026-08-28T13:00:00.000Z', endedAt: null }
    ]
    expect(totalMinutes(entries, '2026-08-28T14:00:00.000Z')).toBe(255)
    expect(totalMinutes([])).toBe(0)
  })
})
