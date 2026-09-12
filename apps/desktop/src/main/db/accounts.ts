import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { accountUserId, setAccountUserId } from '../sync/meta'
import { openDatabase, type Database, type OpenOptions } from './index'

/*
 * One database file per account.
 *
 * Signed out, the app works on the local file. Signed in, it works on a file
 * named after the account, so two people who share a machine never see each
 * other's ledger and the engine never has to refuse a sync as "another
 * account's".
 *
 * The local file is where work goes before there is an account — a first
 * evening with the app, or the seed in development. The first account to
 * sign in takes it over: the file is renamed into the account's, rows and
 * cursor and all, so nothing made before signing up is left behind. A local
 * file that was already stamped with a different account (an install from
 * before there were per-account files, signed in as someone else since) is
 * left where it is, for that account to take over when it signs in.
 *
 * Plain functions over the filesystem and the database; no Electron.
 */

export const LOCAL_DATABASE = 'trackit.db'

/** The file an account works on: the local one signed out, its own signed in. */
export function databaseFileFor(directory: string, userId: string | null): string {
  return join(directory, userId === null ? LOCAL_DATABASE : `trackit-${userId}.db`)
}

/**
 * Opens the database for an account, adopting the local file when this is
 * the account's first sign-in on the machine and the local file is free to
 * take. A signed-out open is the local file, never stamped.
 *
 * The caller must not have the local file open: adoption renames it, and a
 * rename of an open file is EBUSY on Windows. Close the old connection first.
 */
export function openAccountDatabase(
  directory: string,
  userId: string | null,
  options: OpenOptions = {}
): Database {
  const file = databaseFileFor(directory, userId)
  if (userId !== null && !existsSync(file)) adoptLocalDatabase(directory, userId, options)

  const db = openDatabase(file, options)
  if (userId !== null && accountUserId(db) === null) setAccountUserId(db, userId)
  return db
}

/** Renames the local file into the account's, when there is one and it is unstamped or already the account's. */
function adoptLocalDatabase(directory: string, userId: string, options: OpenOptions): void {
  const local = databaseFileFor(directory, null)
  if (!existsSync(local)) return

  /* Opened to read the stamp, and closed cleanly so the WAL is folded back
     into the file before it moves. */
  const db = openDatabase(local, options)
  const owner = accountUserId(db)
  db.close()
  if (owner !== null && owner !== userId) return

  const target = databaseFileFor(directory, userId)
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${local}${suffix}`)) renameSync(`${local}${suffix}`, `${target}${suffix}`)
  }
}
