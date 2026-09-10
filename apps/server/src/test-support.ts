import { sql } from 'drizzle-orm'
import { createApp, type Logger } from './app'
import { loadConfig, type Config } from './config'
import { connect, migrate, type DbHandle } from './db'

/*
 * What every integration test starts from: a configuration pointed at the
 * compose file's Postgres, a migrated database, and a way to empty it.
 *
 * DATABASE_URL may be set to run against another Postgres; the default is
 * the one docker-compose.yml serves.
 */

export const TEST_DATABASE_URL = 'postgres://trackit:trackit@localhost:5433/trackit'

export function testConfig(overrides: Partial<Config> = {}): Config {
  const base = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL ?? TEST_DATABASE_URL,
    JWT_SECRET: 'test-secret-that-is-at-least-thirty-two-characters-long',
    /* Generous, so ordinary tests never trip it; the limiter test lowers it. */
    AUTH_RATE_LIMIT_MAX: '1000'
  })
  return { ...base, ...overrides }
}

export const silentLog: Logger = { info: () => undefined, error: () => undefined }

export type TestDb = DbHandle & {
  /** Empties every table. TRUNCATE ... CASCADE reaches the syncable tables through users. */
  reset: () => Promise<void>
}

export async function openTestDb(config: Config): Promise<TestDb> {
  const handle = connect(config.databaseUrl)
  await migrate(handle.db)
  return {
    ...handle,
    reset: async () => {
      await handle.db.execute(sql`TRUNCATE TABLE users CASCADE`)
    }
  }
}

export const appFor = (config: Config, handle: DbHandle, now?: () => Date) =>
  createApp({ config, db: handle.db, log: silentLog, now })
