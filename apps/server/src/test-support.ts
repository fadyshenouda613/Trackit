import { sql } from 'drizzle-orm'
import { createApp, type Logger } from './app'
import { loadConfig, type Config } from './config'
import { connect, migrate, type DbHandle } from './db'
import { createPdfRenderer, type PdfRenderer } from './invoices/pdf'

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

/*
 * Quiet on the request log, loud on anything unhandled: a 500 in a test is
 * only ever the error the handler swallowed, so it goes to stderr where the
 * run (and CI) shows it next to the failing assertion.
 */
export const testLog: Logger = { info: () => undefined, error: (message, error) => console.error(message, error) }

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

/*
 * One browser for a whole test file, launched only if a test asks for a
 * PDF, and closed by that file's afterAll through closeTestPdf — a browser
 * left open keeps the worker alive past the run.
 */
let pdf: PdfRenderer | null = null
export const testPdf = (): PdfRenderer => (pdf ??= createPdfRenderer())
export const closeTestPdf = async (): Promise<void> => {
  const open = pdf
  pdf = null
  await open?.close()
}

export const appFor = (config: Config, handle: DbHandle, now?: () => Date) =>
  createApp({ config, db: handle.db, log: testLog, pdf: testPdf(), now })
