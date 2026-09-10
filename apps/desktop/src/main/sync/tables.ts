import type { Database } from 'better-sqlite3'
import {
  SYNC_TABLE_ORDER,
  syncPullRowSchemas,
  syncPushRowSchemas,
  type SyncPullRow,
  type SyncPushRow,
  type SyncTableName
} from '@trackit/shared/schemas'
import { fromColumns, toColumns, type Row } from '../db/rows'
import { checklistItemsTable } from '../repositories/checklist-items'
import { clientsTable } from '../repositories/clients'
import { invoiceLinesTable, invoicesTable, paymentsTable } from '../repositories/invoices'
import { milestonesTable } from '../repositories/milestones'
import { notesTable } from '../repositories/notes'
import { projectsTable } from '../repositories/projects'
import { timeEntriesTable } from '../repositories/time-entries'

/*
 * What the engine knows about each local table: how its rows read and
 * write, and which of them is the settings row. Built on the repositories'
 * own table definitions, so the boolean columns are named once.
 */

export type LocalSyncTable = {
  name: SyncTableName
  /** `id` for the nine entity tables; the settings row is the one with id 1. */
  key: 'id' | 'user'
  booleans: ReadonlySet<string>
  push: (typeof syncPushRowSchemas)[SyncTableName]
  pull: (typeof syncPullRowSchemas)[SyncTableName]
  /** The project a row belongs to, for grouping conflicts. Null when it has none. */
  projectIdOf: (row: Record<string, unknown>) => string | null
}

const NO_BOOLEANS: ReadonlySet<string> = new Set()

const projectId = (row: Record<string, unknown>): string | null =>
  typeof row['projectId'] === 'string' ? (row['projectId'] as string) : null

const define = (
  name: SyncTableName,
  booleans: ReadonlySet<string>,
  projectIdOf: LocalSyncTable['projectIdOf'],
  key: LocalSyncTable['key'] = 'id'
): LocalSyncTable => ({ name, key, booleans, push: syncPushRowSchemas[name], pull: syncPullRowSchemas[name], projectIdOf })

const own = (row: Record<string, unknown>): string | null => (typeof row['id'] === 'string' ? (row['id'] as string) : null)
const none = (): null => null

export const localSyncTables: Record<SyncTableName, LocalSyncTable> = {
  clients: define('clients', clientsTable.booleans, none),
  projects: define('projects', projectsTable.booleans, own),
  milestones: define('milestones', milestonesTable.booleans, projectId),
  checklist_items: define('checklist_items', checklistItemsTable.booleans, projectId),
  notes: define('notes', notesTable.booleans, projectId),
  invoices: define('invoices', invoicesTable.booleans, none),
  invoice_lines: define('invoice_lines', invoiceLinesTable.booleans, projectId),
  time_entries: define('time_entries', timeEntriesTable.booleans, projectId),
  payments: define('payments', paymentsTable.booleans, none),
  settings: define('settings', NO_BOOLEANS, none, 'user')
}

/** The tables parent-first, as everything iterates them. */
export const orderedLocalSyncTables: LocalSyncTable[] = SYNC_TABLE_ORDER.map((name) => localSyncTables[name])

/** The `WHERE` that finds a table's row: by id, or the one settings row. */
export const whereRow = (table: LocalSyncTable): string => (table.key === 'id' ? 'id = @id' : 'id = 1')

/** The key a row is remembered by while in flight: its id, or nothing for settings. */
export const rowKey = (table: LocalSyncTable, row: Record<string, unknown>): string =>
  table.key === 'id' ? (row['id'] as string) : ''

/**
 * A stored row as it travels: columns back to fields, booleans restored,
 * and parsed through the push schema, which drops `syncState` and — for
 * settings — the id and the two machine-local preferences.
 */
export const toPushRow = (table: LocalSyncTable, raw: Row): SyncPushRow =>
  table.push.parse(fromColumns(raw, table.booleans))

/**
 * A pulled row as it is stored: `updatedBy` is not a column, and the row
 * becomes `synced` because it is, by definition, what the server holds.
 */
export function toStoredColumns(table: LocalSyncTable, row: SyncPullRow): Row {
  const { updatedBy: _, ...fields } = row as Record<string, unknown> & { updatedBy: string | null }
  const columns = toColumns({ ...fields, syncState: 'synced' })
  if (table.key === 'user') columns['id'] = 1
  return columns
}

/** Any row of a table by key, deleted or not, as fields. Null when there is none. */
export function findLocalRow(db: Database, table: LocalSyncTable, id: string): Record<string, unknown> | null {
  const raw = db.prepare(`SELECT * FROM ${table.name} WHERE ${whereRow(table)}`).get({ id }) as Row | undefined
  return raw ? fromColumns(raw, table.booleans) : null
}
