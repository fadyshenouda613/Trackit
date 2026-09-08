import type { Database } from 'better-sqlite3'
import {
  timeEntrySchema,
  type CreateTimeEntryInput,
  type StartTimerInput,
  type TimeEntry,
  type TimeEntryListFilters,
  type UpdateTimeEntryInput
} from '@trackit/shared/schemas'
import { nowIso } from '../db/clock'
import { RepositoryError } from './errors'
import { createRow, defineTable, getRow, selectRows, softDeleteRow, updateRow } from './table'

export const timeEntriesTable = defineTable<TimeEntry>({
  name: 'time_entries',
  label: 'time entry',
  schema: timeEntrySchema
})

/** The entry with no end yet — the running timer — or null. */
export function runningTimeEntry(db: Database): TimeEntry | null {
  const [entry] = selectRows(
    timeEntriesTable,
    db.prepare(
      `SELECT * FROM time_entries
       WHERE ended_at IS NULL AND deleted_at IS NULL
       ORDER BY started_at DESC LIMIT 1`
    )
  )
  return entry ?? null
}

/** Only one clock runs at a time. */
function assertNoOtherRunning(db: Database, id: string): void {
  const running = runningTimeEntry(db)
  if (running && running.id !== id) {
    throw new RepositoryError('invalid_state', 'A timer is already running; stop it before starting another')
  }
}

export function createTimeEntry(db: Database, input: CreateTimeEntryInput): TimeEntry {
  if (input.endedAt === null) assertNoOtherRunning(db, input.id)
  return createRow(db, timeEntriesTable, input)
}

/** Merged and re-checked as a whole, so an end that lands before the start is refused. */
export function updateTimeEntry(db: Database, id: string, patch: UpdateTimeEntryInput): TimeEntry {
  if (patch.endedAt === null) assertNoOtherRunning(db, id)
  return updateRow(db, timeEntriesTable, id, patch)
}

export const deleteTimeEntry = (db: Database, id: string): TimeEntry =>
  softDeleteRow(db, timeEntriesTable, id)

export const getTimeEntry = (db: Database, id: string): TimeEntry | null =>
  getRow(db, timeEntriesTable, id)

/** A window on the log, oldest first: one project's, one week's, or all of it. */
export function listTimeEntries(db: Database, filters: TimeEntryListFilters = {}): TimeEntry[] {
  const where = ['deleted_at IS NULL']
  const params: Record<string, unknown> = {}

  if (filters.projectId !== undefined) {
    where.push('project_id = @projectId')
    params['projectId'] = filters.projectId
  }
  if (filters.from !== undefined) {
    where.push('started_at >= @from')
    params['from'] = filters.from
  }
  if (filters.to !== undefined) {
    where.push('started_at < @to')
    params['to'] = filters.to
  }

  return selectRows(
    timeEntriesTable,
    db.prepare(`SELECT * FROM time_entries WHERE ${where.join(' AND ')} ORDER BY started_at, id`),
    params
  )
}

/** Starts the clock now. The store sets the start; a client cannot backdate one. */
export function startTimer(db: Database, input: StartTimerInput, now: string = nowIso()): TimeEntry {
  assertNoOtherRunning(db, input.id)
  return createRow(db, timeEntriesTable, {
    id: input.id,
    projectId: input.projectId,
    checklistItemId: input.checklistItemId,
    note: input.note,
    startedAt: now,
    endedAt: null,
    source: 'timer'
  })
}

/** Ends the running entry at `now`. */
export function stopTimer(db: Database, now: string = nowIso()): TimeEntry {
  const running = runningTimeEntry(db)
  if (!running) throw new RepositoryError('invalid_state', 'No timer is running')
  return updateRow(db, timeEntriesTable, running.id, { endedAt: now })
}

/**
 * Ends every open entry — what `before-quit` calls, so a clean exit never
 * leaves a clock running. Anything still open at the next launch therefore
 * survived a crash, which is what the recovery dialog is for.
 */
export function closeOpenEntries(db: Database, now: string = nowIso()): TimeEntry[] {
  const open = selectRows(
    timeEntriesTable,
    db.prepare('SELECT * FROM time_entries WHERE ended_at IS NULL AND deleted_at IS NULL ORDER BY started_at')
  )
  return open.map((entry) => updateRow(db, timeEntriesTable, entry.id, { endedAt: now }))
}

/**
 * The running entry, if it predates this launch. A clock this process started
 * is just running; one that was already running when the process came up
 * belongs to a session that never ended.
 */
export function orphanedTimeEntry(db: Database, bootedAt: string): TimeEntry | null {
  const running = runningTimeEntry(db)
  return running && running.startedAt < bootedAt ? running : null
}

/** The most recently started live entry: the project the tray offers to restart. */
export function latestTimeEntry(db: Database): TimeEntry | null {
  const [entry] = selectRows(
    timeEntriesTable,
    db.prepare('SELECT * FROM time_entries WHERE deleted_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1')
  )
  return entry ?? null
}
