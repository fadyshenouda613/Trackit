import type { Database } from 'better-sqlite3'
import type { SyncPushChanges, SyncPushRow, SyncTableName } from '@trackit/shared/schemas'
import type { Row } from '../db/rows'
import { orderedLocalSyncTables, rowKey, toPushRow, whereRow, type LocalSyncTable } from './tables'

/*
 * The outbox: what this machine has changed and the server has not seen.
 *
 * Nothing is queued anywhere. A row is pending because its sync_state says
 * so, and it stops being pending when the version that went up is the
 * version still stored — which is why every pushed row is remembered with
 * the updatedAt it was read at, and marked by it.
 */

/** A row as it was pushed: enough to mark it synced only if it has not moved since. */
export type PushedRef = { table: SyncTableName; id: string; updatedAt: string }

export type Outbox = {
  changes: SyncPushChanges
  pushed: PushedRef[]
  /** Whether pending rows remain beyond the cap. */
  more: boolean
}

/**
 * Up to `cap` pending rows, parent tables first, oldest edits first within
 * a table so a long backlog goes up in the order it was made.
 */
export function collectPending(db: Database, cap: number): Outbox {
  const changes: SyncPushChanges = {}
  const pushed: PushedRef[] = []
  let more = false

  for (const table of orderedLocalSyncTables) {
    const remaining = cap - pushed.length
    if (remaining <= 0) {
      if (hasPending(db, table)) more = true
      continue
    }
    const raws = db
      .prepare(`SELECT * FROM ${table.name} WHERE sync_state = 'pending' ORDER BY updated_at, id LIMIT ?`)
      .all(remaining + 1) as Row[]
    if (raws.length > remaining) {
      more = true
      raws.length = remaining
    }
    if (raws.length === 0) continue

    const rows = raws.map((raw) => toPushRow(table, raw))
    // The rows are the table's own push rows; the map is keyed by the same name.
    ;(changes as Record<SyncTableName, SyncPushRow[]>)[table.name] = rows
    for (const row of rows) {
      pushed.push({ table: table.name, id: rowKey(table, row as Record<string, unknown>), updatedAt: row.updatedAt })
    }
  }

  return { changes, pushed, more }
}

const hasPending = (db: Database, table: LocalSyncTable): boolean =>
  db.prepare(`SELECT 1 FROM ${table.name} WHERE sync_state = 'pending' LIMIT 1`).get() !== undefined

/** `table:id`, the key a rejection is looked up by. */
export const refKey = (ref: { table: SyncTableName; id: string }): string => `${ref.table}:${ref.id}`

/**
 * Marks pushed rows synced — only where the stored updatedAt is still the
 * one that went up, so an edit made while the request was in flight stays
 * pending and goes up next time, and a row the pull has just overwritten
 * with a newer version is left as the pull left it. `skip` names the rows
 * the server would not keep for now (a missing parent), which also stay
 * pending. Answers with how many rows it marked: the ones whose version
 * now stands on the server.
 */
export function markSynced(db: Database, pushed: PushedRef[], skip: ReadonlySet<string>): number {
  const statements = new Map<SyncTableName, ReturnType<Database['prepare']>>()
  let marked = 0
  for (const ref of pushed) {
    if (skip.has(refKey(ref))) continue
    const table = orderedLocalSyncTables.find((candidate) => candidate.name === ref.table)
    if (!table) continue
    let statement = statements.get(ref.table)
    if (!statement) {
      statement = db.prepare(
        `UPDATE ${table.name} SET sync_state = 'synced' WHERE ${whereRow(table)} AND updated_at = @updatedAt`
      )
      statements.set(ref.table, statement)
    }
    marked += statement.run({ id: ref.id, updatedAt: ref.updatedAt }).changes
  }
  return marked
}
