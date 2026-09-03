import type { Database } from 'better-sqlite3'

/*
 * Migrations: numbered SQL files applied in order, once each, on boot.
 *
 * The `migrations` table remembers which have run. Everything pending is
 * applied inside one transaction — SQLite's DDL is transactional, so a
 * migration that fails halfway leaves the file as it was and the app refuses
 * to start rather than starting on half a schema. An old migration is never
 * edited; a change to the schema is the next file.
 */

export type Migration = {
  /** The file's name without its extension, e.g. `001_initial`. Sorted as text. */
  name: string
  sql: string
}

export type MigrationLog = (message: string) => void

const NAME = /^\d{3,}_[a-z0-9_-]+$/

/** Throws unless the names are numbered, unique and in order. */
export function checkMigrationNames(names: string[]): void {
  const seen = new Set<string>()
  let previous = ''
  for (const name of names) {
    if (!NAME.test(name)) throw new Error(`Migration "${name}" is not numbered like 001_name`)
    const number = name.slice(0, name.indexOf('_'))
    if (seen.has(number)) throw new Error(`Two migrations carry the number ${number}`)
    if (name <= previous) throw new Error(`Migration "${name}" is out of order after "${previous}"`)
    seen.add(number)
    previous = name
  }
}

/** The migrations already applied to this database, in the order they ran. */
export function appliedMigrations(db: Database): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`
  )
  return db
    .prepare<[], { name: string }>('SELECT name FROM migrations ORDER BY name')
    .all()
    .map((row) => row.name)
}

/**
 * Applies every migration not yet in the table, in order, in one transaction.
 * Returns the names it applied.
 */
export function runMigrations(
  db: Database,
  migrations: Migration[],
  log: MigrationLog = () => undefined
): string[] {
  checkMigrationNames(migrations.map((migration) => migration.name))

  const applied = new Set(appliedMigrations(db))
  const pending = migrations.filter((migration) => !applied.has(migration.name))

  if (pending.length === 0) {
    log(`Database is at ${migrations.at(-1)?.name ?? 'no migrations'}; nothing to apply`)
    return []
  }

  const record = db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')

  const apply = db.transaction((batch: Migration[]) => {
    for (const migration of batch) {
      log(`Applying migration ${migration.name}`)
      db.exec(migration.sql)
      record.run(migration.name, new Date().toISOString())
    }
  })

  apply(pending)
  log(`Applied ${pending.length} migration${pending.length === 1 ? '' : 's'}`)
  return pending.map((migration) => migration.name)
}
