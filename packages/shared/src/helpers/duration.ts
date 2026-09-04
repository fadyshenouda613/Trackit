/**
 * Durations and clock times, held as minutes and formatted at the edge.
 *
 * A time entry is two timestamps; everything the app says about it is in
 * minutes, because retyping an end time has to move the row, its day, the
 * week and the comparison against last week all at once.
 */

const MINUTES_PER_DAY = 1440
const MS_PER_MINUTE = 60_000

export const pad2 = (value: number): string => String(value).padStart(2, '0')

/** Whole minutes from an hours budget: 0.5h is 30m. */
export const hoursToMinutes = (hours: number): number => Math.round(hours * 60)

/**
 * Minutes between two clock times of the day. An end below the start means
 * the span ran past midnight, so it wraps rather than going negative.
 */
export const clockSpanMinutes = (startMin: number, endMin: number): number =>
  (((endMin - startMin) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY

/**
 * Whole minutes a time entry has run. A running entry (no `endedAt`) is
 * measured up to `now`, which the caller supplies so the answer is testable
 * and so a list of rows agrees on one "now".
 */
export function entryMinutes(
  entry: { startedAt: string; endedAt: string | null },
  now: string = new Date().toISOString()
): number {
  const start = Date.parse(entry.startedAt)
  const end = Date.parse(entry.endedAt ?? now)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.floor((end - start) / MS_PER_MINUTE))
}

export const totalMinutes = (
  entries: { startedAt: string; endedAt: string | null }[],
  now?: string
): number => entries.reduce((sum, entry) => sum + entryMinutes(entry, now), 0)

/** An em dash rather than "0h 00m": a row with no times yet has no duration. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours === 0 ? `${rest}m` : `${hours}h ${pad2(rest)}m`
}

/** "32h" reads as a budget; "32h 00m" reads as a measurement. */
export const formatBudget = (minutes: number): string =>
  minutes > 0 && minutes % 60 === 0 ? `${minutes / 60}h` : formatDuration(minutes)

/** A clock time from minutes since midnight, 12-hour: "9:15 AM". */
export function formatClock(minutes: number): string {
  const hours24 = Math.floor(minutes / 60) % 24
  const suffix = hours24 < 12 ? 'AM' : 'PM'
  return `${hours24 % 12 || 12}:${pad2(minutes % 60)} ${suffix}`
}

/**
 * Forgiving about how a time is typed — "9:15am", "0915", "9 15 PM", "14:00"
 * all land. Returns null when it cannot tell, and the field reverts rather than
 * silently logging a time nobody meant.
 */
export function parseClock(text: string): number | null {
  const match = text
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})[:.\s]?(\d{2})?\s*(a|p)?\.?m?\.?$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]

  if (minutes > 59) return null
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    if (meridiem === 'p' && hours !== 12) hours += 12
    if (meridiem === 'a' && hours === 12) hours = 0
  } else if (hours > 23) {
    return null
  }

  return hours * 60 + minutes
}

/**
 * Whole seconds a timer has run, from its stored start to a caller-supplied
 * "now". Computed, never accumulated: a machine that sleeps for the night
 * wakes up with the right answer, and one whose clock is set back reads zero
 * rather than a negative number.
 */
export function elapsedSeconds(startedAt: string, nowMs: number): number {
  const start = Date.parse(startedAt)
  if (!Number.isFinite(start)) return 0
  return Math.max(0, Math.floor((nowMs - start) / 1000))
}

/** "01:24:36" — the timer bar's and the tray's clock. */
export const formatElapsed = (seconds: number): string =>
  `${pad2(Math.floor(seconds / 3600))}:${pad2(Math.floor(seconds / 60) % 60)}:${pad2(seconds % 60)}`
