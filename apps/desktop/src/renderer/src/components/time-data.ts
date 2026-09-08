/*
 * The Time screen's week arithmetic and sync-clock prose.
 *
 * The log itself lives on the store now — entries are UTC ISO timestamps,
 * read back as minutes since local midnight at the edge. What is here is the
 * week window a filter asks the store for, and the labels drawn from it.
 *
 * The arithmetic itself — durations, clock times, calendar days — lives in
 * @trackit/shared so the server can do the same sums.
 */

import {
  addDays,
  formatDuration,
  pad2,
  shortDate,
  type Client,
  type Id,
  type Project,
  type TimeEntry
} from '@trackit/shared'
import { atLocal, localDateOf, MONTHS, WEEKDAYS } from './local-dates'

export type { TimeEntry }

/* ---- Dates ---------------------------------------------------------------
 * Weeks run Monday to Sunday, against whatever day the caller says is today —
 * the store has a clock now, so nothing here is a constant any more. */

const asDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

/** Weeks run Monday to Sunday. */
const mondayOf = (iso: string): string => {
  const day = asDate(iso).getUTCDay()
  return addDays(iso, day === 0 ? -6 : 1 - day)
}

export const weekStartFor = (offset: number, today: string): string =>
  addDays(mondayOf(today), offset * 7)

export type WeekWindow = { offset: number; start: string; from: string; to: string }

/** The list filter for one week: local Monday 00:00 to the next, as UTC ISO. */
export function weekWindow(offset: number, today: string): WeekWindow {
  const start = weekStartFor(offset, today)
  return { offset, start, from: atLocal(start, 0), to: atLocal(addDays(start, 7), 0) }
}

/**
 * Newest first, and the current week stops at today: a Saturday that has not
 * happened yet is not a day you failed to log.
 */
export function daysOf(week: WeekWindow, today: string): string[] {
  const days: string[] = []
  for (let i = 0; i < 7; i += 1) {
    const iso = addDays(week.start, i)
    if (week.offset === 0 && iso > today) break
    days.push(iso)
  }
  return days.reverse()
}

export function dayLabel(iso: string, today: string): { primary: string; secondary: string } {
  const date = asDate(iso)
  const secondary = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
  if (iso === today) return { primary: 'Today', secondary }
  if (iso === addDays(today, -1)) return { primary: 'Yesterday', secondary }
  return { primary: WEEKDAYS[date.getUTCDay()], secondary }
}

/** A finished entry's local day. */
export const dayOf = (entry: TimeEntry): string => localDateOf(entry.startedAt)

/** The client a project belongs to, by name, for the log's client column. */
export const clientNameOf = (projectId: Id, projects: Project[], clients: Client[]): string => {
  const p = projects.find((x) => x.id === projectId)
  return clients.find((c) => c.id === p?.clientId)?.company ?? ''
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

/** The header's comparison. Direction is carried by the caret, never by colour. */
export function formatDelta(minutes: number, previous: number): string {
  if (previous === 0) return 'No entries last week'
  const diff = minutes - previous
  if (diff === 0) return 'Same as last week'
  return `${diff > 0 ? '▲' : '▼'} ${formatDuration(Math.abs(diff))} vs last week`
}

/* ---- Wall-clock recency ---------------------------------------------------
 * Everything above is ledger time: calendar days and week windows. A sync
 * timestamp is the opposite kind of fact. It is not something the
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
