/**
 * The arithmetic the app exists for: what a fixed fee comes to per hour once
 * the hours are real, and how far through the budget those hours are.
 *
 * Everything here is integer cents and whole minutes in, and a rounded
 * figure out. Nothing is stored — a rate is always recomputed from the price
 * and the log, so it can never be stale.
 */

/**
 * How a judged figure reads. The renderer maps these onto its tone tokens;
 * `neutral` is deliberately absent — an unjudged figure is `null`, not a tone.
 */
export type Judgement = 'positive' | 'warning' | 'negative'

/**
 * A rate under the floor is negative. Above it but within this ratio of it
 * is "marginal" — the Projects table's warning band — and past it is positive.
 * The band is what the table's fixtures draw: +15% and +22% are warnings,
 * +26% is not.
 */
export const MARGINAL_RATE_RATIO = 1.25

/** Budget used at or past this per cent is a warning; past 100 is negative. */
export const BUDGET_WARNING_PERCENT = 80

/** `part` as a whole per cent of `whole`, or null when there is no whole. */
export const percentOf = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 100) : null

/**
 * Price over hours logged, in cents per hour. Null with nothing logged — a
 * draft has no rate, and dividing by zero would only print infinity.
 */
export const effectiveRateCents = (priceCents: number, loggedMinutes: number): number | null =>
  loggedMinutes > 0 ? Math.round((priceCents * 60) / loggedMinutes) : null

/** "If you hit that budget": the rate the estimate implies before any hours exist. */
export const impliedRateCents = (priceCents: number, budgetedHours: number): number | null =>
  effectiveRateCents(priceCents, Math.round(budgetedHours * 60))

/** How far a rate sits from the floor, as a whole per cent; null without a floor. */
export const rateVsFloorPercent = (rateCents: number, floorCents: number): number | null =>
  floorCents > 0 ? Math.round((rateCents / floorCents - 1) * 100) : null

/** Below the floor, marginally above it, or comfortably above it. */
export function rateJudgement(rateCents: number, floorCents: number): Judgement {
  if (rateCents < floorCents) return 'negative'
  if (rateCents < floorCents * MARGINAL_RATE_RATIO) return 'warning'
  return 'positive'
}

/** One rate across many projects: total price over total minutes. */
export function blendedRateCents(
  projects: { priceCents: number; loggedMinutes: number }[]
): number | null {
  const priceCents = projects.reduce((sum, project) => sum + project.priceCents, 0)
  const minutes = projects.reduce((sum, project) => sum + project.loggedMinutes, 0)
  return effectiveRateCents(priceCents, minutes)
}

export type BudgetConsumption = {
  /** Whole per cent of the budget used; over 100 when over. Null without a budget. */
  percent: number | null
  /** Minutes still in the budget, never below zero. */
  remainingMinutes: number
  /** Minutes past the budget, zero while under it. */
  overMinutes: number
  over: boolean
}

/** Where the logged hours sit against the budget. */
export function budgetConsumption(loggedMinutes: number, budgetMinutes: number): BudgetConsumption {
  return {
    percent: percentOf(loggedMinutes, budgetMinutes),
    remainingMinutes: Math.max(0, budgetMinutes - loggedMinutes),
    overMinutes: Math.max(0, loggedMinutes - budgetMinutes),
    over: loggedMinutes > budgetMinutes
  }
}

/** Under the warning band, in it, or over the budget. */
export function budgetJudgement(percent: number): Judgement {
  if (percent > 100) return 'negative'
  if (percent >= BUDGET_WARNING_PERCENT) return 'warning'
  return 'positive'
}

export type ChecklistProgress = {
  done: number
  total: number
  /** Zero for an empty list, so a bar can still be drawn. */
  percent: number
}

/** How much of a checklist is ticked. */
export function checklistProgress(items: { done: boolean }[]): ChecklistProgress {
  const total = items.length
  const done = items.filter((item) => item.done).length
  return { done, total, percent: percentOf(done, total) ?? 0 }
}
