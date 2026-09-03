/*
 * The Time screen's seed and its arithmetic.
 *
 * Every other seed in the app is pre-formatted strings ("28h 15m") because
 * nothing recomputes. The weekly log does: retyping an end time has to move the
 * row's duration, its day total, the week total and the comparison against last
 * week all at once. So times are held as minutes and formatted at the edge.
 *
 * The arithmetic itself — durations, clock times, calendar days — lives in
 * @trackit/shared so the server can do the same sums. What is here is the
 * seed and the week.
 */

import { addDays, clockSpanMinutes, formatDuration, pad2, shortDate } from '@trackit/shared'

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

const asDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

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

/* ---- Durations ----------------------------------------------------------- */

export const durationOf = (entry: TimeEntry): number =>
  clockSpanMinutes(entry.startMin, entry.endMin)

export const totalOf = (entries: TimeEntry[]): number =>
  entries.reduce((sum, entry) => sum + durationOf(entry), 0)

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

/* ---- Wall-clock recency ---------------------------------------------------
 * Everything above is ledger time: ISO dates measured against TODAY, which is
 * a constant because the app has no clock and a fixture that drifted would
 * make the artboards' figures wrong overnight.
 *
 * A sync timestamp is the opposite kind of fact. It is not something the
 * ledger records — it is something that happened to this machine a moment ago,
 * and "4 minutes ago" is only true while you are reading it. So these two take
 * epoch milliseconds and measure against a real Date.now(), and they are kept
 * apart from the dates above on purpose: mixing the two would either freeze
 * the footer at a fictional hour or start moving the invoice dates.
 */

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

const plural = (count: number, unit: string): string =>
  `${count} ${unit}${count === 1 ? '' : 's'} ago`

/**
 * Prose, for the popover: 'just now', '4 minutes ago', '2 hours ago', and past
 * a day the date itself, because "31 hours ago" is arithmetic, not a time.
 */
export function agoLabel(at: number | null, now: number = Date.now()): string {
  if (at === null) return '—'
  const since = Math.max(0, now - at)
  if (since < 45_000) return 'just now'
  if (since < HOUR) return plural(Math.round(since / MINUTE), 'minute')
  if (since < DAY) return plural(Math.round(since / HOUR), 'hour')
  return shortDate(new Date(at).toISOString().slice(0, 10))
}

/**
 * The same fact for the sidebar's 10px mono slot, where a sentence does not
 * fit: 'now', '4m', '2h', then the day and month.
 */
export function agoShort(at: number | null, now: number = Date.now()): string {
  if (at === null) return '—'
  const since = Math.max(0, now - at)
  if (since < 45_000) return 'now'
  if (since < HOUR) return `${Math.round(since / MINUTE)}m`
  if (since < DAY) return `${Math.round(since / HOUR)}h`
  return shortDate(new Date(at).toISOString().slice(0, 10)).slice(0, 6)
}

/** The exact time a sync landed, 24-hour, as the app states every other clock. */
export const clockOf = (at: number): string =>
  `${pad2(new Date(at).getHours())}:${pad2(new Date(at).getMinutes())}`
