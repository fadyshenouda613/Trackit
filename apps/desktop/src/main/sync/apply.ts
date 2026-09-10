import type { Database } from 'better-sqlite3'
import type { SyncPullChanges, SyncPullRow } from '@trackit/shared/schemas'
import type { Row } from '../db/rows'
import { recordConflict } from './conflicts'
import { describeRow } from './describe'
import { findLocalRow, orderedLocalSyncTables, rowKey, toStoredColumns, whereRow, type LocalSyncTable } from './tables'

/*
 * Applying what the server sent, row by row, parent tables first.
 *
 *   no local row     insert it, synced — tombstones included, so a second
 *                    machine holds the same history as the first
 *   local is synced  the server is the authority: take anything not older
 *   local is pending this machine has an edit the server has not seen yet.
 *                    The incoming version wins if it is newer, or the same
 *                    instant from a greater device id — the server's own
 *                    rule, applied here so both sides agree. When it wins
 *                    and says something different, that is a conflict, and
 *                    it is recorded before the row is overwritten. When it
 *                    loses, the local edit stays exactly as it is and goes
 *                    up on the next push. This machine's own version coming
 *                    back is neither: it is confirmation, and the row is
 *                    marked synced.
 *
 * Runs inside the caller's transaction. Applying the same changes twice
 * changes nothing the second time: every row is then synced with an equal
 * updatedAt, and a synced row is only rewritten when something differs.
 */

export type ApplyContext = {
  /** This install's id, which breaks ties. */
  deviceId: string
  /** When conflicts are stamped. */
  now: string
}

export type ApplyResult = {
  /** Rows whose stored values changed. An echo of this machine's own row is not one. */
  applied: number
  conflicts: number
}

type Fields = Record<string, unknown>

/** The columns compared and copied: everything the wire carries but who wrote it. */
const NOT_A_FIELD: ReadonlySet<string> = new Set(['updatedBy'])
/** Differences that are not a disagreement about the record. */
const NOT_A_CONFLICT: ReadonlySet<string> = new Set(['updatedBy', 'updatedAt', 'syncState'])

export function applyChanges(db: Database, changes: SyncPullChanges, context: ApplyContext): ApplyResult {
  const result: ApplyResult = { applied: 0, conflicts: 0 }
  for (const table of orderedLocalSyncTables) {
    const rows = changes[table.name] ?? []
    for (const row of rows) applyRow(db, table, row as SyncPullRow, context, result)
  }
  return result
}

function applyRow(db: Database, table: LocalSyncTable, row: SyncPullRow, context: ApplyContext, result: ApplyResult): void {
  const incoming = row as Fields
  const key = rowKey(table, incoming)
  const local = findLocalRow(db, table, key)

  if (!local) {
    if (table.key === 'user') return
    insert(db, table, row)
    result.applied += 1
    return
  }

  const incomingAt = Date.parse(incoming['updatedAt'] as string)
  const localAt = Date.parse(local['updatedAt'] as string)

  if (local['syncState'] === 'synced') {
    if (incomingAt < localAt) return
    if (sameVersion(local, incoming)) return
    write(db, table, row, key)
    result.applied += 1
    return
  }

  const wins =
    incomingAt > localAt ||
    (incomingAt === localAt && ((incoming['updatedBy'] as string | null) ?? '') > context.deviceId)
  const echo = incomingAt === localAt && incoming['updatedBy'] === context.deviceId

  if (!wins && !echo) return

  if (echo) {
    /* Our own version back from the server: confirmation, not a change. */
    write(db, table, row, key)
    return
  }

  /* The other device's version wins over an edit it never saw. */
  const fields = differingFields(local, incoming)
  if (fields.length > 0) {
    recordConflict(db, {
      table: table.name,
      rowId: key,
      kind: table.name === 'checklist_items' && fields.length === 1 && fields[0] === 'sortOrder' ? 'reorder' : 'record',
      projectId: table.projectIdOf(local),
      label: describeRow(db, table.name, local),
      fields,
      local: wireFields(local, incoming),
      remote: wireFields(incoming, incoming),
      detectedAt: context.now
    })
    result.conflicts += 1
  }

  write(db, table, row, key)
  result.applied += 1
}

/** Every stored value the wire carries, including updatedAt, is the same. */
function sameVersion(local: Fields, incoming: Fields): boolean {
  for (const [field, value] of Object.entries(incoming)) {
    if (NOT_A_FIELD.has(field)) continue
    if (local[field] !== value) return false
  }
  return true
}

/** The fields on which the two versions disagree about the record. */
function differingFields(local: Fields, incoming: Fields): string[] {
  const fields: string[] = []
  for (const [field, value] of Object.entries(incoming)) {
    if (NOT_A_CONFLICT.has(field)) continue
    if (local[field] !== value) fields.push(field)
  }
  return fields.sort()
}

/** A row cut to the fields the wire knows, so what a conflict keeps is what travels. */
function wireFields(source: Fields, shape: Fields): Fields {
  const fields: Fields = {}
  for (const field of Object.keys(shape)) {
    if (NOT_A_FIELD.has(field)) continue
    fields[field] = source[field]
  }
  return fields
}

function insert(db: Database, table: LocalSyncTable, row: SyncPullRow): void {
  const columns = toStoredColumns(table, row)
  const names = Object.keys(columns)
  db.prepare(`INSERT INTO ${table.name} (${names.join(', ')}) VALUES (${names.map((name) => `@${name}`).join(', ')})`).run(
    columns
  )
}

function write(db: Database, table: LocalSyncTable, row: SyncPullRow, key: string): void {
  const columns: Row = toStoredColumns(table, row)
  const assignments = Object.keys(columns)
    .filter((column) => column !== 'id')
    .map((column) => `${column} = @${column}`)
  db.prepare(`UPDATE ${table.name} SET ${assignments.join(', ')} WHERE ${whereRow(table)}`).run({ ...columns, id: key })
}
