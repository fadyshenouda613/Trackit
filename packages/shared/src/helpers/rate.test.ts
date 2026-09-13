import { describe, expect, it } from 'vitest'
import {
  blendedRateCents,
  budgetConsumption,
  budgetJudgement,
  checklistProgress,
  effectiveRateCents,
  impliedRateCents,
  percentOf,
  rateJudgement,
  rateVsFloorPercent
} from './rate'

/* The figures the Projects table prints, so the arithmetic matches the screen. */
const BRAND_REFRESH = { priceCents: 650000, loggedMinutes: 28 * 60 + 15 }
const SITE_BUILD = { priceCents: 900000, loggedMinutes: 112 * 60 + 40 }
const REPORT_DESIGN = { priceCents: 45000, loggedMinutes: 9 * 60 + 5 }
const TRADE_SHOW = { priceCents: 340000, loggedMinutes: 19 * 60 + 30 }

const FLOOR = 10000

describe('percentOf', () => {
  it('rounds to a whole per cent and is null without a whole', () => {
    expect(percentOf(8, 14)).toBe(57)
    expect(percentOf(0, 14)).toBe(0)
    expect(percentOf(3, 0)).toBeNull()
  })
})

describe('effectiveRateCents', () => {
  it('is the price over the hours, to the cent', () => {
    expect(effectiveRateCents(BRAND_REFRESH.priceCents, BRAND_REFRESH.loggedMinutes)).toBe(23009)
    expect(effectiveRateCents(SITE_BUILD.priceCents, SITE_BUILD.loggedMinutes)).toBe(7988)
    expect(effectiveRateCents(REPORT_DESIGN.priceCents, REPORT_DESIGN.loggedMinutes)).toBe(4954)
    expect(effectiveRateCents(TRADE_SHOW.priceCents, TRADE_SHOW.loggedMinutes)).toBe(17436)
  })

  it('has no answer with nothing logged', () => {
    expect(effectiveRateCents(750000, 0)).toBeNull()
  })
})

describe('impliedRateCents', () => {
  it('is the rate the estimate implies', () => {
    expect(impliedRateCents(1200000, 80)).toBe(15000)
    expect(impliedRateCents(1200000, 0)).toBeNull()
  })
})

describe('rateVsFloorPercent', () => {
  it('reads "+130% vs floor" and "−20% below floor" off the table', () => {
    expect(rateVsFloorPercent(23009, FLOOR)).toBe(130)
    expect(rateVsFloorPercent(7988, FLOOR)).toBe(-20)
    expect(rateVsFloorPercent(10000, FLOOR)).toBe(0)
  })

  it('is null without a floor', () => {
    expect(rateVsFloorPercent(23009, 0)).toBeNull()
  })
})

describe('rateJudgement', () => {
  it('draws the same three bands the table does', () => {
    expect(rateJudgement(7988, FLOOR)).toBe('negative')
    expect(rateJudgement(11020, FLOOR)).toBe('warning')
    expect(rateJudgement(12203, FLOOR)).toBe('warning')
    expect(rateJudgement(12644, FLOOR)).toBe('positive')
    expect(rateJudgement(23009, FLOOR)).toBe('positive')
  })

  it('treats the floor itself as marginal, not below', () => {
    expect(rateJudgement(FLOOR, FLOOR)).toBe('warning')
  })
})

describe('blendedRateCents', () => {
  it('is one rate over all the work, matching the table footer', () => {
    /* "$47,800.00 · 341h 25m · $140.00/hr — active and delivered work only". */
    expect(blendedRateCents([{ priceCents: 4780000, loggedMinutes: 341 * 60 + 25 }])).toBe(14000)
    expect(blendedRateCents([BRAND_REFRESH, SITE_BUILD])).toBe(
      effectiveRateCents(1550000, BRAND_REFRESH.loggedMinutes + SITE_BUILD.loggedMinutes)
    )
    expect(blendedRateCents([])).toBeNull()
  })
})

describe('budgetConsumption', () => {
  it('reads "88% · 3h 45m left of a 32h budget" off the project header', () => {
    expect(budgetConsumption(BRAND_REFRESH.loggedMinutes, 32 * 60)).toEqual({
      percent: 88,
      remainingMinutes: 225,
      overMinutes: 0,
      over: false
    })
  })

  it('runs past 100 when over, and says by how much', () => {
    expect(budgetConsumption(SITE_BUILD.loggedMinutes, 80 * 60)).toEqual({
      percent: 141,
      remainingMinutes: 0,
      overMinutes: 1960,
      over: true
    })
  })

  it('is not over at exactly the budget, and has no per cent without one', () => {
    expect(budgetConsumption(1920, 1920).over).toBe(false)
    expect(budgetConsumption(1920, 1920).percent).toBe(100)
    expect(budgetConsumption(60, 0).percent).toBeNull()
    expect(budgetConsumption(60, 0).over).toBe(true)
  })
})

describe('budgetJudgement', () => {
  it('warns from 80% and turns negative past the budget', () => {
    expect(budgetJudgement(38)).toBe('positive')
    expect(budgetJudgement(78)).toBe('positive')
    expect(budgetJudgement(80)).toBe('warning')
    expect(budgetJudgement(98)).toBe('warning')
    expect(budgetJudgement(100)).toBe('warning')
    expect(budgetJudgement(141)).toBe('negative')
  })
})

describe('checklistProgress', () => {
  it('counts the ticks and rounds the per cent', () => {
    const items = [...Array(8).fill({ done: true }), ...Array(6).fill({ done: false })]
    expect(checklistProgress(items)).toEqual({ done: 8, total: 14, percent: 57 })
  })

  it('is zero, not undefined, for an empty list', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, percent: 0 })
  })
})

/*
 * The edges of the rate arithmetic: nothing to divide by, nothing to divide,
 * and hours that are not whole. Every answer is integer cents or null.
 */

describe('effectiveRateCents at the edges', () => {
  it('is zero, not null, for a fee of nothing with hours against it', () => {
    expect(effectiveRateCents(0, 90)).toBe(0)
  })

  it('divides a fee in cents by fractional hours to a whole cent', () => {
    /* $6,500 over 1h 30m is $4,333.33/hr; over one minute it is $390,000/hr. */
    expect(effectiveRateCents(650000, 90)).toBe(433333)
    expect(effectiveRateCents(650000, 1)).toBe(39000000)
    /* 100001 × 60 / 7 = 857151.43 */
    expect(effectiveRateCents(100001, 7)).toBe(857151)
  })

  it('rounds a half cent up', () => {
    expect(effectiveRateCents(1, 120)).toBe(1)
  })

  it('has no answer for minutes that are not positive', () => {
    expect(effectiveRateCents(650000, -30)).toBeNull()
  })

  it('never answers with a fraction of a cent', () => {
    for (const minutes of [1, 7, 13, 90, 28 * 60 + 15, 112 * 60 + 40]) {
      for (const priceCents of [1, 99, 45000, 650000, 12345678]) {
        expect(Number.isInteger(effectiveRateCents(priceCents, minutes))).toBe(true)
      }
    }
  })
})

describe('impliedRateCents with a fractional budget', () => {
  it('takes the budget to whole minutes first', () => {
    expect(impliedRateCents(100000, 0.5)).toBe(200000)
    expect(impliedRateCents(100000, 1 / 3)).toBe(300000)
  })

  it('is null when the budget rounds to no minutes at all', () => {
    expect(impliedRateCents(100000, 0.004)).toBeNull()
  })
})

describe('blendedRateCents weighting', () => {
  it('is total fee over total minutes, not the mean of the rates', () => {
    /* $1,000/hr and $250/hr blend to $2,000 over 5h = $400/hr, not $625. */
    const a = { priceCents: 100000, loggedMinutes: 60 }
    const b = { priceCents: 100000, loggedMinutes: 240 }
    expect(blendedRateCents([a, b])).toBe(40000)
  })

  it('counts a fee with no hours yet, and hours with no fee', () => {
    const logged = { priceCents: 100000, loggedMinutes: 60 }
    expect(blendedRateCents([logged, { priceCents: 100000, loggedMinutes: 0 }])).toBe(200000)
    expect(blendedRateCents([logged, { priceCents: 0, loggedMinutes: 60 }])).toBe(50000)
  })

  it('is null when the work adds up to no minutes, whatever the fees', () => {
    expect(blendedRateCents([{ priceCents: 100000, loggedMinutes: 0 }])).toBeNull()
  })
})

describe('percentOf rounding', () => {
  it('rounds thirds and a half per cent, and runs past 100', () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(1, 200)).toBe(1)
    expect(percentOf(3, 2)).toBe(150)
  })
})

describe('rateVsFloorPercent rounding', () => {
  it('rounds a half per cent toward positive infinity either side of the floor, as Math.round does', () => {
    expect(rateVsFloorPercent(11250, FLOOR)).toBe(13)
    expect(rateVsFloorPercent(8750, FLOOR)).toBe(-12)
  })
})

describe('budgetConsumption with nothing logged', () => {
  it('is zero per cent with the whole budget left', () => {
    expect(budgetConsumption(0, 1920)).toEqual({
      percent: 0,
      remainingMinutes: 1920,
      overMinutes: 0,
      over: false
    })
  })

  it('has no per cent and is not over when neither exists', () => {
    expect(budgetConsumption(0, 0)).toEqual({
      percent: null,
      remainingMinutes: 0,
      overMinutes: 0,
      over: false
    })
  })
})
