import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate as runMigrations } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema>

export type DbHandle = {
  db: Db
  /** Ends every connection. Awaited on shutdown and at the end of a test run. */
  close: () => Promise<void>
}

/** A pool on the given URL, typed against the schema. Nothing is queried until asked. */
export function connect(databaseUrl: string): DbHandle {
  const pool = new Pool({ connectionString: databaseUrl })
  return { db: drizzle({ client: pool, schema }), close: () => pool.end() }
}

/**
 * Where drizzle-kit writes the migrations: apps/server/drizzle. Found by
 * walking up from this file, because this file runs from two depths — src/db
 * in development and the tests, dist/ once bundled — and a fixed relative
 * path would be right in only one of them. MIGRATIONS_DIR overrides it.
 */
export function migrationsFolder(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = resolve(dir, 'drizzle')
    if (existsSync(resolve(candidate, 'meta', '_journal.json'))) return candidate
    dir = dirname(dir)
  }
  throw new Error('Cannot find the drizzle/ migrations folder; set MIGRATIONS_DIR')
}

/** Brings the database up to the latest migration. Safe to run every start. */
export async function migrate(db: Db): Promise<void> {
  await runMigrations(db, { migrationsFolder: migrationsFolder() })
}

export { schema }
