import { shortDate } from '@trackit/shared'

export const MONTHS = [
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
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const pad = (n: number): string => String(n).padStart(2, '0')

/** The local calendar day of a UTC timestamp, as YYYY-MM-DD. */
export const localDateOf = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const todayIso = (now: Date = new Date()): string => localDateOf(now.toISOString())
/** "26 Aug 2026" — padded, for columns. Null prints an em dash. */
export const dateLabel = (iso: string | null): string => (iso ? shortDate(localDateOf(iso)) : '—')
/** "26 Aug" */
export const dayMonth = (iso: string): string => dateLabel(iso).slice(0, 6)
/** "8 Aug 2026" — unpadded, for prose. */
export const longDate = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}
/** "Mar 2024" */
export const monthYear = (iso: string): string => {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}
/** "Friday, 28 August 2026" — the dashboard header. */
export const dashboardDate = (now: Date): string =>
  `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`
/** Local midnight of a YYYY-MM-DD plus minutes, as a UTC ISO timestamp. */
export const atLocal = (day: string, minutes: number): string => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 0, minutes).toISOString()
}
/** Minutes since local midnight of a UTC timestamp. */
export const localMinutesOf = (iso: string): number => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
/** "08 Sep 2026", "8 Sep 2026" or "2026-09-08" → YYYY-MM-DD, else null. */
export function parseShortDate(text: string): string | null {
  const t = text.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/)
  if (!m) return null
  const month = MONTHS.findIndex((name) => name.slice(0, 3).toLowerCase() === m[2].toLowerCase())
  if (month < 0) return null
  return `${m[3]}-${pad(month + 1)}-${pad(Number(m[1]))}`
}
