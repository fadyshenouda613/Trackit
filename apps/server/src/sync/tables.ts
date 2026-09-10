import { getTableColumns, sql } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import {
  SYNC_TABLE_ORDER,
  syncPullRowSchemas,
  syncPushRowSchemas,
  type SyncPullRow,
  type SyncTableName
} from '@trackit/shared/schemas'
import * as schema from '../db/schema'

/*
 * What the sync service knows about each table: its Drizzle definition,
 * which of its fields point at which parent table, and how a row crosses
 * between the wire (camelCase, ISO strings) and Postgres (snake_case,
 * timestamptz). Nothing about a particular table is spelled out anywhere
 * else in the service.
 */

export type WireRow = Record<string, unknown>

export type SyncTable = {
  name: SyncTableName
  table: PgTable
  /** Wire field → the table the id in it must exist in, for this user. */
  parents: Readonly<Partial<Record<string, SyncTableName>>>
  /** `id` for the nine entity tables; the settings row is keyed by the user. */
  key: 'id' | 'user'
  push: (typeof syncPushRowSchemas)[SyncTableName]
  pull: (typeof syncPullRowSchemas)[SyncTableName]
}

const define = (
  name: SyncTableName,
  table: PgTable,
  parents: SyncTable['parents'],
  key: SyncTable['key'] = 'id'
): SyncTable => ({ name, table, parents, key, push: syncPushRowSchemas[name], pull: syncPullRowSchemas[name] })

export const syncTables: Record<SyncTableName, SyncTable> = {
  clients: define('clients', schema.clients, {}),
  projects: define('projects', schema.projects, { clientId: 'clients' }),
  milestones: define('milestones', schema.milestones, { projectId: 'projects' }),
  checklist_items: define('checklist_items', schema.checklistItems, { projectId: 'projects' }),
  notes: define('notes', schema.notes, { projectId: 'projects', clientId: 'clients' }),
  invoices: define('invoices', schema.invoices, { clientId: 'clients', replacedByInvoiceId: 'invoices' }),
  invoice_lines: define('invoice_lines', schema.invoiceLines, {
    invoiceId: 'invoices',
    projectId: 'projects',
    milestoneId: 'milestones'
  }),
  time_entries: define('time_entries', schema.timeEntries, {
    projectId: 'projects',
    checklistItemId: 'checklist_items'
  }),
  payments: define('payments', schema.payments, { invoiceId: 'invoices' }),
  settings: define('settings', schema.settings, {}, 'user')
}

/** The tables parent-first, as everything iterates them. */
export const orderedSyncTables: SyncTable[] = SYNC_TABLE_ORDER.map((name) => syncTables[name])

/* ---- Columns --------------------------------------------------------------- */

/** The server's own columns, which a wire row neither carries nor may set. */
const SERVER_COLUMNS: ReadonlySet<string> = new Set(['userId', 'serverSeq', 'updatedBy'])

type ColumnInfo = { field: string; column: string; isTimestamp: boolean }

const columnsOf = (table: PgTable): ColumnInfo[] =>
  Object.entries(getTableColumns(table)).map(([field, column]: [string, PgColumn]) => ({
    field,
    column: column.name,
    isTimestamp: column.columnType === 'PgTimestamp'
  }))

const cache = new WeakMap<PgTable, ColumnInfo[]>()

/** Every column of a table, once. */
export function columns(table: SyncTable): ColumnInfo[] {
  let info = cache.get(table.table)
  if (!info) {
    info = columnsOf(table.table)
    cache.set(table.table, info)
  }
  return info
}

/** The columns a wire row fills: everything but the server's own. */
export const wireColumns = (table: SyncTable): ColumnInfo[] =>
  columns(table).filter((info) => !SERVER_COLUMNS.has(info.field))

/* ---- Conversions --------------------------------------------------------------- */

/** A wire value as Postgres takes it: ISO strings become dates on the timestamp columns. */
export const toColumnValue = (info: ColumnInfo, value: unknown): unknown =>
  info.isTimestamp && typeof value === 'string' ? new Date(value) : value

/**
 * A timestamptz as a raw statement hands it back. Drizzle leaves `pg`'s
 * date parsing off and returns the text form, `2026-09-10 09:00:00.5+00`,
 * which is not ISO 8601 and which Date does not reliably read. This turns
 * it into the ISO instant every timestamp is stored as, microseconds and
 * all: the server holds what the client sent, to the millisecond.
 */
const PG_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)?([+-]\d{2})(?::?(\d{2}))?$/

export function pgTimestampToIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'string') throw new Error(`Not a timestamp: ${String(value)}`)
  const match = PG_TIMESTAMP.exec(value)
  if (!match) throw new Error(`Unreadable timestamp from Postgres: ${value}`)
  const [, date, time, fraction = '', hours, minutes = '00'] = match
  return new Date(`${date}T${time}${fraction}${hours}:${minutes}`).toISOString()
}

/** The instant of a timestamptz, as epoch milliseconds. */
export const pgTimestampToMs = (value: unknown): number => Date.parse(pgTimestampToIso(value))

/**
 * A raw Postgres row as the wire carries it: dates back to ISO, the server's
 * own columns dropped bar `updatedBy`, and the result parsed, so a row that
 * has drifted from the shared schema fails here rather than on a client.
 */
export function toPullRow(table: SyncTable, raw: Record<string, unknown>): SyncPullRow {
  const row: WireRow = {}
  for (const info of columns(table)) {
    if (info.field === 'userId' || info.field === 'serverSeq') continue
    const value = raw[info.column]
    row[info.field] = info.isTimestamp && value !== null ? pgTimestampToIso(value) : value
  }
  return table.pull.parse(row)
}

/** `pg` hands bigints back as strings; the sequence is a number to us. */
export const seqOf = (raw: Record<string, unknown>): number => Number(raw['server_seq'])

/** A quoted table name for a raw statement. */
export const tableName = (table: SyncTable) => sql.identifier(table.name)
