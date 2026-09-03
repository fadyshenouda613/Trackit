import BetterSqlite3, { type Database } from 'better-sqlite3'
import { runMigrations, type MigrationLog } from './migrate'
import { migrations } from './migrations'

export type { Database } from 'better-sqlite3'

export type OpenOptions = {
  /** Where to say what happened. Defaults to silence, which is what tests want. */
  log?: MigrationLog
}

/**
 * Opens (creating if needed) a Trackit database and brings it up to date.
 *
 * WAL keeps readers and the writer out of each other's way, which matters
 * once the sync engine writes in the background while the renderer reads.
 * Foreign keys are off by default in SQLite and have to be asked for per
 * connection.
 */
export function openDatabase(file: string, options: OpenOptions = {}): Database {
  const db = new BetterSqlite3(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  runMigrations(db, migrations, options.log)
  return db
}

/** A fresh database in memory with the whole schema applied. For tests. */
export const openMemoryDatabase = (): Database => openDatabase(':memory:')
