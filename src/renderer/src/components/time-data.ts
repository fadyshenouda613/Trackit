/*
 * The Time screen's seed and its arithmetic.
 *
 * Every other seed in the app is pre-formatted strings ("28h 15m") because
 * nothing recomputes. The weekly log does: retyping an end time has to move the
 * row's duration, its day total, the week total and the comparison against last
 * week all at once. So times are held as minutes and formatted at the edge.
 */

/** Minutes since midnight. `endMin` below `startMin` means it ran past midnight. */
export type TimeEntry = {
  id: string
  /** The day it belongs to, as an ISO date. */
  iso: string
  project: string
  note: string
  startMin: number
  endMin: number
}

export type Week = {
  /** 0 is the current week; every step back is -1. */
  offset: number
  /** Monday, as an ISO date. */
  start: string
  /** Last week's total, for the header comparison. */
  previousMinutes: number
  entries: TimeEntry[]
}

/*
 * The project list and its client mapping are the ones in AllProjectsTable —
 * a global log has to name the same work the projects screen does. Cancelled
 * work is left out; you cannot log against it.
 */
export const projectClients: Record<string, string> = {
  'Brand refresh': 'Northwind Studio',
  'Site build': 'Sable Studio',
  'Report design': 'Ortega & Co',
  'Packaging system': 'Marlow Foods',
  'Editorial templates': 'Kestrel Press',
  'Onboarding emails': 'Halcyon Labs',
  'Trade show panels': 'Northwind Studio',
  'Annual report layout': 'Brandt & Vale',
  'Menu system': 'Meridian Coffee',
  'Site copy refresh': 'Northwind Studio',
  'Wholesale one-pager': 'Marlow Foods',
  'Rebrand phase 2': 'Kestrel Press'
}

export const projectNames = Object.keys(projectClients)

/** Only live work can start a timer, so the header picker is the shorter list. */
export const startableProjects = [
  'Brand refresh',
  'Site build',
  'Report design',
  'Packaging system',
  'Editorial templates',
  'Onboarding emails'
]

export const clientFor = (project: string): string => projectClients[project] ?? ''

/* ---- Dates ---------------------------------------------------------------
 * The app has no clock — the dashboard names its own day — so "today" is a
 * constant here too, and every other screen's copy is written against it. */

export const TODAY = '2026-08-28' // Friday

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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const pad2 = (value: number): string => String(value).padStart(2, '0')

const asDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

const asIso = (date: Date): string => date.toISOString().slice(0, 10)

export const addDays = (iso: string, days: number): string => {
  const date = asDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return asIso(date)
}

/** Weeks run Monday to Sunday. */
const mondayOf = (iso: string): string => {
  const day = asDate(iso).getUTCDay()
  return addDays(iso, day === 0 ? -6 : 1 - day)
}

export const weekStartFor = (offset: number): string => addDays(mondayOf(TODAY), offset * 7)

/**
 * Newest first, and the current week stops at today: a Saturday that has not
 * happened yet is not a day you failed to log.
 */
export function daysOf(week: Week): string[] {
  const days: string[] = []
  for (let i = 0; i < 7; i += 1) {
    const iso = addDays(week.start, i)
    if (week.offset === 0 && iso > TODAY) break
    days.push(iso)
  }
  return days.reverse()
}

export function dayLabel(iso: string): { primary: string; secondary: string } {
  const date = asDate(iso)
  const secondary = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
  if (iso === TODAY) return { primary: 'Today', secondary }
  if (iso === addDays(TODAY, -1)) return { primary: 'Yesterday', secondary }
  return { primary: WEEKDAYS[date.getUTCDay()], secondary }
}

/** "24–30 Aug 2026", collapsing the parts the two ends share. */
export function weekRangeLabel(start: string): string {
  const from = asDate(start)
  const to = asDate(addDays(start, 6))
  const month = (date: Date): string => MONTHS[date.getUTCMonth()].slice(0, 3)
  const year = to.getUTCFullYear()

  if (from.getUTCMonth() === to.getUTCMonth()) {
    return `${from.getUTCDate()}–${to.getUTCDate()} ${month(to)} ${year}`
  }
  return `${from.getUTCDate()} ${month(from)} – ${to.getUTCDate()} ${month(to)} ${year}`
}

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
  return `${pad2(date.getUTCDate())} ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCFullYear()}`
}

/* ---- Durations ----------------------------------------------------------- */

export const durationOf = (entry: TimeEntry): number =>
  (entry.endMin - entry.startMin + 1440) % 1440

export const totalOf = (entries: TimeEntry[]): number =>
  entries.reduce((sum, entry) => sum + durationOf(entry), 0)

/** An em dash rather than "0h 00m": a row with no times yet has no duration. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours === 0 ? `${rest}m` : `${hours}h ${pad2(rest)}m`
}

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

/** The header's comparison. Direction is carried by the caret, never by colour. */
export function formatDelta(minutes: number, previous: number): string {
  if (previous === 0) return 'No entries last week'
  const diff = minutes - previous
  if (diff === 0) return 'Same as last week'
  return `${diff > 0 ? '▲' : '▼'} ${formatDuration(Math.abs(diff))} vs last week`
}

/* ---- The seed ------------------------------------------------------------
 * Three weeks, so the arrows have somewhere to go and the header comparison
 * changes when they do. This week deliberately skips Wednesday and the week
 * before last is empty outright — the two shapes the "no entries" line has to
 * hold. Anything further back comes back empty.
 */

const entry = (
  id: string,
  iso: string,
  project: string,
  note: string,
  startMin: number,
  endMin: number
): TimeEntry => ({ id, iso, project, note, startMin, endMin })

const thisWeek: TimeEntry[] = [
  entry('e1', '2026-08-24', 'Site build', 'Nav and footer build', 570, 765),
  entry('e2', '2026-08-24', 'Onboarding emails', 'Sequence copy', 820, 900),
  entry('e3', '2026-08-24', 'Brand refresh', 'Kickoff call and notes', 915, 995),
  entry('e4', '2026-08-25', 'Packaging system', 'Dieline revisions', 600, 795),
  entry('e5', '2026-08-25', 'Site build', 'Component audit', 840, 980),
  entry('e6', '2026-08-25', 'Brand refresh', 'Competitor sweep', 990, 1085),
  entry('e7', '2026-08-27', 'Report design', 'Chart styling for section 3', 530, 730),
  entry('e8', '2026-08-27', 'Brand refresh', 'Type scale exploration', 810, 975),
  entry('e9', '2026-08-28', 'Brand refresh', 'Logo lockup refinements', 555, 700),
  entry('e10', '2026-08-28', 'Brand refresh', 'Colour system pass', 785, 930),
  entry('e11', '2026-08-28', 'Editorial templates', 'Grid spec review', 945, 1020)
]

const lastWeek: TimeEntry[] = [
  entry('p1', '2026-08-17', 'Site build', 'Sprint planning', 840, 940),
  entry('p2', '2026-08-18', 'Editorial templates', 'Master pages', 545, 750),
  entry('p3', '2026-08-18', 'Brand refresh', 'Stakeholder review', 840, 925),
  entry('p4', '2026-08-19', 'Site build', 'Auth screens', 580, 775),
  entry('p5', '2026-08-19', 'Onboarding emails', 'Welcome sequence', 830, 920),
  entry('p6', '2026-08-20', 'Brand refresh', 'Moodboard round two', 610, 780),
  entry('p7', '2026-08-20', 'Packaging system', 'Print spec call', 855, 945),
  entry('p8', '2026-08-21', 'Site build', 'Responsive pass', 540, 730),
  entry('p9', '2026-08-21', 'Report design', 'Data table spec', 795, 935)
]

const seeded: Record<number, { entries: TimeEntry[]; previousMinutes: number }> = {
  0: { entries: thisWeek, previousMinutes: 1265 },
  [-1]: { entries: lastWeek, previousMinutes: 1180 },
  [-2]: { entries: [], previousMinutes: 0 }
}

export function weekFor(offset: number): Week {
  const seed = seeded[offset] ?? { entries: [], previousMinutes: 0 }
  return {
    offset,
    start: weekStartFor(offset),
    previousMinutes: seed.previousMinutes,
    entries: seed.entries.map((item) => ({ ...item }))
  }
}

/**
 * Whole days from `from` to `to`, negative when `to` is earlier. The invoice
 * register measures overdue in days and had no way to ask.
 */
export const daysBetween = (from: string, to: string): number =>
  Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86400000)
