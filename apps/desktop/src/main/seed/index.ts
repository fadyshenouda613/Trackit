import { existsSync, unlinkSync } from 'node:fs'
import { openDatabase } from '../db'
import { seedDatabase } from './seed'

export type SeedOptions = {
  /** The database file to load into. */
  file: string
  /** Remove the file first, so the seed starts from an empty schema. */
  reset: boolean
  log: (message: string) => void
}

/**
 * `npm run seed`: loads the fixture data into the app's database so a first
 * run in development looks the way the screens were drawn. Refuses to load
 * on top of existing data; `npm run seed -- --reset` starts the file over.
 * Returns the process exit code.
 */
export function runSeed({ file, reset, log }: SeedOptions): number {
  if (reset) {
    for (const suffix of ['', '-wal', '-shm']) {
      const path = `${file}${suffix}`
      if (existsSync(path)) {
        unlinkSync(path)
        log(`Removed ${path}`)
      }
    }
  }

  const db = openDatabase(file, { log })
  try {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM clients').get() as { count: number }
    if (count > 0) {
      log(`${file} already holds ${count} clients. Run with --reset to start it over.`)
      return 1
    }

    const summary = seedDatabase(db)
    for (const [table, rows] of Object.entries(summary)) log(`${table}: ${rows} rows`)
    log(`Seeded ${file}`)
    return 0
  } finally {
    db.close()
  }
}
