import type { Database } from 'better-sqlite3'
import type { z } from 'zod'
import type { SyncableBase } from '@trackit/shared/schemas'
import { nowIso } from '../db/clock'
import { fromColumns, toColumns, type Row } from '../db/rows'
import { RepositoryError } from './errors'

/*
 * What every repository does the same way.
 *
 * A table is named once, with the schema its rows parse to. Creating a row
 * stamps the four base columns; every write stamps `updatedAt` and marks the
 * row `pending` for sync; a delete sets `deletedAt` and nothing else. Reads
 * go through the schema, so a row that has drifted from what the app expects
 * fails loudly here rather than quietly somewhere in a screen.
 */

export type Table<T extends SyncableBase> = {
  name: string
  /** For messages: "client", "invoice line". */
  label: string
  schema: z.ZodType<T>
  /** The fields stored as 0/1. */
  booleans: ReadonlySet<string>
}

export function defineTable<T extends SyncableBase>(table: {
  name: string
  label: string
  schema: z.ZodType<T>
  booleans?: readonly string[]
}): Table<T> {
  return { ...table, booleans: new Set(table.booleans ?? []) }
}

/** What a caller supplies to `createRow`: the entity minus the store's columns. */
export type CreateFields<T extends SyncableBase> = Omit<
  T,
  'createdAt' | 'updatedAt' | 'deletedAt' | 'syncState'
>

export const parseRow = <T extends SyncableBase>(table: Table<T>, row: Row): T =>
  table.schema.parse(fromColumns(row, table.booleans))

/** Rows matching a query, each parsed. The SQL must select the table's own columns. */
export function selectRows<T extends SyncableBase>(
  table: Table<T>,
  statement: { all: (params: Row) => unknown[] },
  params: Row = {}
): T[] {
  return statement.all(params).map((row) => parseRow(table, row as Row))
}

/** Any row by id, deleted or not. */
export function findRow<T extends SyncableBase>(db: Database, table: Table<T>, id: string): T | null {
  const row = db.prepare(`SELECT * FROM ${table.name} WHERE id = ?`).get(id) as Row | undefined
  return row ? parseRow(table, row) : null
}

/** A live row by id, or null. */
export function getRow<T extends SyncableBase>(db: Database, table: Table<T>, id: string): T | null {
  const row = findRow(db, table, id)
  return row && row.deletedAt === null ? row : null
}

/** A live row by id, or a not_found error. */
export function requireRow<T extends SyncableBase>(db: Database, table: Table<T>, id: string): T {
  const row = getRow(db, table, id)
  if (!row) throw new RepositoryError('not_found', `No ${table.label} with id ${id}`)
  return row
}

/** Inserts a fully formed entity after parsing it. The seed's way in. */
export function insertRow<T extends SyncableBase>(db: Database, table: Table<T>, entity: T): T {
  const parsed = table.schema.parse(entity)
  const row = toColumns(parsed)
  const columns = Object.keys(row)
  db.prepare(
    `INSERT INTO ${table.name} (${columns.join(', ')})
     VALUES (${columns.map((column) => `@${column}`).join(', ')})`
  ).run(row)
  return parsed
}

/** Creates a row from its fields: stamps the base columns, validates, inserts. */
export function createRow<T extends SyncableBase>(
  db: Database,
  table: Table<T>,
  fields: CreateFields<T>
): T {
  const now = nowIso()
  // The spread is what the schema checks; the cast only names the outcome.
  const entity = {
    ...fields,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncState: 'pending'
  } as unknown as T
  return insertRow(db, table, entity)
}

function writeRow<T extends SyncableBase>(db: Database, table: Table<T>, entity: T): T {
  const parsed = table.schema.parse(entity)
  const row = toColumns(parsed)
  const assignments = Object.keys(row)
    .filter((column) => column !== 'id')
    .map((column) => `${column} = @${column}`)
  db.prepare(`UPDATE ${table.name} SET ${assignments.join(', ')} WHERE id = @id`).run(row)
  return parsed
}

/**
 * Merges a patch into a live row, re-validates the whole row — which is how a
 * partial that cannot prove an invariant on its own gets checked — and writes
 * it back stamped `updatedAt` and `pending`.
 */
export function updateRow<T extends SyncableBase>(
  db: Database,
  table: Table<T>,
  id: string,
  patch: Partial<T>
): T {
  const current = requireRow(db, table, id)
  return writeRow(db, table, { ...current, ...patch, id, updatedAt: nowIso(), syncState: 'pending' })
}

/** A soft delete: `deletedAt` set, nothing removed. Deleting twice is a not_found. */
export function softDeleteRow<T extends SyncableBase>(db: Database, table: Table<T>, id: string): T {
  const current = requireRow(db, table, id)
  const now = nowIso()
  return writeRow(db, table, { ...current, deletedAt: now, updatedAt: now, syncState: 'pending' })
}
