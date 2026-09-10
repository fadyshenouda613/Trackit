import { sql, type SQL } from 'drizzle-orm'
import {
  SYNC_TABLE_ORDER,
  type SyncPullChanges,
  type SyncPullRow,
  type SyncRejection,
  type SyncRequestEnvelope,
  type SyncResponse,
  type SyncTableName
} from '@trackit/shared/schemas'
import type { Db } from '../db'
import {
  orderedSyncTables,
  pgTimestampToMs,
  seqOf,
  syncTables,
  tableName,
  toColumnValue,
  toPullRow,
  wireColumns,
  type SyncTable,
  type WireRow
} from './tables'

/*
 * One sync, as a plain function over the database.
 *
 * The whole thing is one transaction that first takes an advisory lock on
 * the account, so an account's syncs are serial: sequence numbers are
 * handed out and read under the same lock, and a row can never be committed
 * behind a cursor a client has already been given. Accounts do not wait on
 * each other.
 *
 * Then the two halves. Push: each incoming row, parent tables first, is
 * kept if it is strictly newer than what is stored (or equal and from the
 * greater device id), rejected if the server cannot hold it, and otherwise
 * left alone with the stored winner queued for the response. Pull: the
 * account's rows after `since`, in sequence order, one page.
 */

export type SyncOptions = {
  /** Rows per page. A client loops while `hasMore`. */
  pageSize: number
}

type Executor = Pick<Db, 'execute'>
type Raw = Record<string, unknown>

export async function runSync(
  db: Db,
  userId: string,
  request: SyncRequestEnvelope,
  options: SyncOptions
): Promise<SyncResponse> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`)

    const rejected: SyncRejection[] = []
    /* Rows that lost: the stored version goes back whatever its sequence. */
    const superseded: { table: SyncTable; where: SQL }[] = []

    for (const table of orderedSyncTables) {
      const rows = request.changes[table.name] ?? []
      for (const incoming of rows) {
        const outcome = await pushRow(tx, userId, request.deviceId, table, incoming)
        if (outcome.kind === 'rejected') rejected.push(outcome.rejection)
        if (outcome.kind === 'superseded') superseded.push({ table, where: outcome.where })
      }
    }

    const page = await pullPage(tx, userId, request.since, options.pageSize)

    /* A winner already in the page is not sent twice. */
    for (const { table, where } of superseded) {
      const result = await tx.execute(sql`SELECT * FROM ${tableName(table)} WHERE ${where}`)
      const raw = result.rows[0] as Raw | undefined
      if (!raw) continue
      const row = toPullRow(table, raw)
      const already = page.changes[table.name]?.some((sent) => sameRow(table, sent, row))
      if (!already) push(page.changes, table.name, row)
    }

    return { cursor: page.cursor, hasMore: page.hasMore, changes: ordered(page.changes), rejected }
  })
}

/* ---- Push ------------------------------------------------------------------- */

type PushOutcome =
  | { kind: 'stored' }
  | { kind: 'superseded'; where: SQL }
  | { kind: 'rejected'; rejection: SyncRejection }

/** Settings has no id; its rejections name the row with an empty string. */
const idOf = (table: SyncTable, row: unknown): string =>
  table.key === 'id' && typeof row === 'object' && row !== null && typeof (row as WireRow)['id'] === 'string'
    ? ((row as WireRow)['id'] as string)
    : ''

async function pushRow(
  tx: Executor,
  userId: string,
  deviceId: string,
  table: SyncTable,
  incoming: unknown
): Promise<PushOutcome> {
  const reject = (reason: SyncRejection['reason']): PushOutcome => ({
    kind: 'rejected',
    rejection: { table: table.name, id: idOf(table, incoming), reason }
  })

  const parsed = table.push.safeParse(incoming)
  if (!parsed.success) return reject('forbidden')
  const row = parsed.data as WireRow

  for (const [field, parentName] of Object.entries(table.parents)) {
    const parentId = row[field]
    if (parentId === null || parentId === undefined) continue
    if (!parentName) continue
    if (!(await parentExists(tx, userId, syncTables[parentName], parentId as string))) {
      return reject('missing_parent')
    }
  }

  const where: SQL =
    table.key === 'id' ? sql`id = ${row['id'] as string}` : sql`user_id = ${userId}`
  const found = await tx.execute(
    sql`SELECT user_id, updated_at, updated_by FROM ${tableName(table)} WHERE ${where}`
  )
  const stored = found.rows[0] as { user_id: string; updated_at: string; updated_by: string | null } | undefined

  if (!stored) {
    await insertRow(tx, userId, deviceId, table, row)
    return { kind: 'stored' }
  }
  if (stored.user_id !== userId) return reject('forbidden')

  if (incomingWins(row['updatedAt'] as string, deviceId, stored)) {
    await updateRow(tx, deviceId, table, row, where)
    return { kind: 'stored' }
  }
  return { kind: 'superseded', where }
}

/**
 * The rule. Strictly newer wins; an equal instant goes to the greater device
 * id, so two machines resolving the same pair agree; a device re-sending
 * its own version is equal on both counts and changes nothing.
 */
function incomingWins(
  incomingAt: string,
  deviceId: string,
  stored: { updated_at: string; updated_by: string | null }
): boolean {
  const incoming = Date.parse(incomingAt)
  const current = pgTimestampToMs(stored.updated_at)
  if (incoming !== current) return incoming > current
  return deviceId > (stored.updated_by ?? '')
}

async function parentExists(tx: Executor, userId: string, parent: SyncTable, id: string): Promise<boolean> {
  const result = await tx.execute(
    sql`SELECT 1 FROM ${tableName(parent)} WHERE id = ${id} AND user_id = ${userId}`
  )
  return result.rows.length > 0
}

async function insertRow(tx: Executor, userId: string, deviceId: string, table: SyncTable, row: WireRow): Promise<void> {
  const infos = wireColumns(table)
  const names = [...infos.map((info) => sql.identifier(info.column)), sql.identifier('user_id'), sql.identifier('updated_by')]
  const values = [...infos.map((info) => sql`${toColumnValue(info, row[info.field])}`), sql`${userId}`, sql`${deviceId}`]
  await tx.execute(
    sql`INSERT INTO ${tableName(table)} (${sql.join(names, sql`, `)}) VALUES (${sql.join(values, sql`, `)})`
  )
}

async function updateRow(tx: Executor, deviceId: string, table: SyncTable, row: WireRow, where: SQL): Promise<void> {
  const assignments = wireColumns(table)
    .filter((info) => info.field !== 'id')
    .map((info) => sql`${sql.identifier(info.column)} = ${toColumnValue(info, row[info.field])}`)
  assignments.push(sql`updated_by = ${deviceId}`, sql`server_seq = nextval('sync_seq')`)
  await tx.execute(sql`UPDATE ${tableName(table)} SET ${sql.join(assignments, sql`, `)} WHERE ${where}`)
}

/* ---- Pull ------------------------------------------------------------------- */

type Page = { cursor: number; hasMore: boolean; changes: SyncPullChanges }

/**
 * Every table is asked for `pageSize + 1` rows after `since`; the merged
 * list is cut at `pageSize`, so memory is bounded by the page and the extra
 * row is what says whether another page follows.
 */
async function pullPage(tx: Executor, userId: string, since: number, pageSize: number): Promise<Page> {
  const merged: { table: SyncTable; seq: number; raw: Raw }[] = []
  for (const table of orderedSyncTables) {
    const result = await tx.execute(
      sql`SELECT * FROM ${tableName(table)}
          WHERE user_id = ${userId} AND server_seq > ${since}
          ORDER BY server_seq
          LIMIT ${pageSize + 1}`
    )
    for (const raw of result.rows as Raw[]) merged.push({ table, seq: seqOf(raw), raw })
  }
  merged.sort((a, b) => a.seq - b.seq)

  const page = merged.slice(0, pageSize)
  const changes: SyncPullChanges = {}
  for (const entry of page) push(changes, entry.table.name, toPullRow(entry.table, entry.raw))

  const last = page[page.length - 1]
  return { cursor: last ? last.seq : since, hasMore: merged.length > pageSize, changes }
}

// The row is the table's own pull row; the map is keyed by the same name.
// Spelling the correlation out per table would be ten identical branches.
function push(changes: SyncPullChanges, table: SyncTableName, row: SyncPullRow): void {
  const list = (changes[table] ?? []) as SyncPullRow[]
  list.push(row)
  ;(changes as Record<SyncTableName, SyncPullRow[]>)[table] = list
}

const sameRow = (table: SyncTable, a: SyncPullRow, b: SyncPullRow): boolean =>
  table.key === 'user' || (a as WireRow)['id'] === (b as WireRow)['id']

/** Parent tables first, whatever order the page was built in. */
function ordered(changes: SyncPullChanges): SyncPullChanges {
  const result: SyncPullChanges = {}
  for (const name of SYNC_TABLE_ORDER) {
    const rows = changes[name]
    if (rows && rows.length > 0) (result as Record<SyncTableName, SyncPullRow[]>)[name] = rows as SyncPullRow[]
  }
  return result
}
