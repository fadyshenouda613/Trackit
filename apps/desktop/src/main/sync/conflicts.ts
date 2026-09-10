import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import {
  syncConflictSchema,
  syncEventSchema,
  type ConflictResolution,
  type SyncConflict,
  type SyncConflictKind,
  type SyncEvent,
  type SyncEventKind,
  type SyncTableName
} from '@trackit/shared/schemas'
import { toColumns, type Row } from '../db/rows'
import { RepositoryError } from '../repositories/errors'
import { bumpedUpdatedAt } from '../repositories/table'
import { localSyncTables, whereRow } from './tables'

/*
 * Conflicts and the log.
 *
 * A conflict is a local pending edit that lost to another device's version.
 * It is already resolved in the data by the time it is written here — the
 * other version is what the row holds — and this is what lets the person
 * see that it happened and, if they want, have their own version back.
 */

type Fields = Record<string, unknown>

export type NewConflict = {
  table: SyncTableName
  rowId: string
  kind: SyncConflictKind
  projectId: string | null
  label: string
  fields: string[]
  /** The losing local version, as fields. */
  local: Fields
  /** The winning remote version, as fields. */
  remote: Fields
  detectedAt: string
}

export function recordConflict(db: Database, conflict: NewConflict): SyncConflict {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO sync_conflicts
       (id, table_name, row_id, kind, project_id, label, fields, local, remote,
        local_deleted_at, remote_deleted_at, detected_at)
     VALUES
       (@id, @table, @rowId, @kind, @projectId, @label, @fields, @local, @remote,
        @localDeletedAt, @remoteDeletedAt, @detectedAt)`
  ).run({
    id,
    table: conflict.table,
    rowId: conflict.rowId,
    kind: conflict.kind,
    projectId: conflict.projectId,
    label: conflict.label,
    fields: JSON.stringify(conflict.fields),
    local: JSON.stringify(conflict.local),
    remote: JSON.stringify(conflict.remote),
    localDeletedAt: (conflict.local['deletedAt'] as string | null | undefined) ?? null,
    remoteDeletedAt: (conflict.remote['deletedAt'] as string | null | undefined) ?? null,
    detectedAt: conflict.detectedAt
  })
  recordEvent(
    db,
    'conflict',
    conflict.kind === 'reorder'
      ? `${conflict.label} — moved on two devices; the other position was kept`
      : `${conflict.label} — edited on two devices; the other version was kept`,
    conflict.detectedAt
  )
  return conflictFromRow(db.prepare('SELECT * FROM sync_conflicts WHERE id = ?').get(id) as Row)
}

function conflictFromRow(row: Row): SyncConflict {
  return syncConflictSchema.parse({
    id: row['id'],
    table: row['table_name'],
    rowId: row['row_id'],
    kind: row['kind'],
    projectId: row['project_id'],
    label: row['label'],
    fields: JSON.parse(row['fields'] as string),
    localDeletedAt: row['local_deleted_at'],
    remoteDeletedAt: row['remote_deleted_at'],
    detectedAt: row['detected_at']
  })
}

/** Unresolved conflicts, newest first. */
export const listConflicts = (db: Database): SyncConflict[] =>
  (
    db
      .prepare('SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY detected_at DESC, id')
      .all() as Row[]
  ).map(conflictFromRow)

/**
 * The two ways out. `keepTheirs` closes the conflict. `restoreMine` writes
 * the losing local version back as a fresh edit — a new updatedAt past the
 * winner's, pending — so it goes up on the next sync and wins everywhere;
 * for a reorder that is the position alone, since nothing else differed.
 */
export function resolveConflict(db: Database, id: string, resolution: ConflictResolution, now: string): void {
  const row = db.prepare('SELECT * FROM sync_conflicts WHERE id = ? AND resolved_at IS NULL').get(id) as
    | Row
    | undefined
  if (!row) throw new RepositoryError('not_found', `No open conflict with id ${id}`)

  if (resolution === 'restoreMine') {
    const table = localSyncTables[row['table_name'] as SyncTableName]
    const local = JSON.parse(row['local'] as string) as Fields
    const kind = row['kind'] as SyncConflictKind
    const current = db.prepare(`SELECT updated_at FROM ${table.name} WHERE ${whereRow(table)}`).get({ id: row['row_id'] }) as
      | { updated_at: string }
      | undefined
    if (current) {
      const restored: Fields =
        kind === 'reorder'
          ? { sortOrder: local['sortOrder'] }
          : Object.fromEntries(
              Object.entries(local).filter(([key]) => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt')
            )
      const columns = toColumns({
        ...restored,
        updatedAt: bumpedUpdatedAt(current.updated_at, now),
        syncState: 'pending'
      })
      const assignments = Object.keys(columns).map((column) => `${column} = @${column}`)
      db.prepare(`UPDATE ${table.name} SET ${assignments.join(', ')} WHERE ${whereRow(table)}`).run({
        ...columns,
        id: row['row_id']
      })
    }
  }

  db.prepare('UPDATE sync_conflicts SET resolved_at = ?, resolution = ? WHERE id = ?').run(now, resolution, id)
}

/* ---- The log ------------------------------------------------------------------ */

/** How many events are kept. The popover shows five; fifty is history enough. */
const EVENTS_KEPT = 50

export function recordEvent(db: Database, kind: SyncEventKind, detail: string, at: string): void {
  db.prepare('INSERT INTO sync_events (id, kind, at, detail) VALUES (?, ?, ?, ?)').run(randomUUID(), kind, at, detail)
  db.prepare(
    `DELETE FROM sync_events WHERE rowid NOT IN (SELECT rowid FROM sync_events ORDER BY at DESC, rowid DESC LIMIT ?)`
  ).run(EVENTS_KEPT)
}

/** The latest events, newest first; two at the same instant in the order they were written. */
export const listEvents = (db: Database, limit: number): SyncEvent[] =>
  (db.prepare('SELECT id, kind, at, detail FROM sync_events ORDER BY at DESC, rowid DESC LIMIT ?').all(limit) as Row[]).map(
    (row) => syncEventSchema.parse(row)
  )
