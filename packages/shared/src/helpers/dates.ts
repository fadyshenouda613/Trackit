/**
 * Ledger dates: calendar days, not instants.
 *
 * A due date, an issue date and an overdue count are all whole days. These
 * work on the `YYYY-MM-DD` part of an ISO string and do their arithmetic in
 * UTC, so the same date string gives the same answer on every machine. A
 * full timestamp is accepted and its date part used.
 */

const MS_PER_DAY = 86_400_000

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** The `YYYY-MM-DD` of a date or a timestamp. */
export const dateOf = (iso: string): string => iso.slice(0, 10)

const asDate = (iso: string): Date => new Date(`${dateOf(iso)}T00:00:00Z`)

const asIso = (date: Date): string => date.toISOString().slice(0, 10)

export const addDays = (iso: string, days: number): string => {
  const date = asDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return asIso(date)
}

/** Whole days from `from` to `to`, negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((asDate(to).getTime() - asDate(from).getTime()) / MS_PER_DAY)

/**
 * "26 Aug 2026" — the form every date on an invoice takes.
 *
 * The day is padded. On its own "2 Jul" would be the friendlier reading, but
 * these dates stack into columns of tabular figures on the Invoices list, and
 * an unpadded day puts a ragged left edge down a column the eye is scanning
 * for one that fell before another.
 */
export function shortDate(iso: string): string {
  const date = asDate(iso)
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${day} ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCFullYear()}`
}
