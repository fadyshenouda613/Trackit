import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'

/*
 * The few facts the engine keeps across launches, as rows of sync_meta.
 * Plain functions over the database, like everything in main.
 */

export function readMeta(db: Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

export function writeMeta(db: Database, key: string, value: string): void {
  db.prepare(
    'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}

const KEYS = {
  cursor: 'cursor',
  deviceId: 'deviceId',
  lastSyncedAt: 'lastSyncedAt',
  accountUserId: 'accountUserId'
} as const

/**
 * Minted the first time it is asked for and never changed: it is what breaks
 * ties on `updatedAt`, so it has to be the same id for the life of the
 * install.
 */
export function deviceId(db: Database): string {
  const existing = readMeta(db, KEYS.deviceId)
  if (existing) return existing
  const minted = randomUUID()
  writeMeta(db, KEYS.deviceId, minted)
  return minted
}

/** The server sequence everything up to which has been applied. Zero on a fresh machine. */
export const cursor = (db: Database): number => Number(readMeta(db, KEYS.cursor) ?? 0)
export const setCursor = (db: Database, value: number): void => writeMeta(db, KEYS.cursor, String(value))

export const lastSyncedAt = (db: Database): string | null => readMeta(db, KEYS.lastSyncedAt)
export const setLastSyncedAt = (db: Database, at: string): void => writeMeta(db, KEYS.lastSyncedAt, at)

/** The account this database was first synced under. Another account is refused. */
export const accountUserId = (db: Database): string | null => readMeta(db, KEYS.accountUserId)
export const setAccountUserId = (db: Database, userId: string): void => writeMeta(db, KEYS.accountUserId, userId)
