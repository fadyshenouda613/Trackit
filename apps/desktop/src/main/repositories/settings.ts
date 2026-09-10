import type { Database } from 'better-sqlite3'
import { settingsSchema, type Settings, type UpdateSettingsInput } from '@trackit/shared/schemas'
import { nowIso } from '../db/clock'
import { fromColumns, toColumns, type Row } from '../db/rows'
import { bumpedUpdatedAt } from './table'

/*
 * One row, put there by the first migration and never deleted. It has an id
 * column only so the CHECK can keep it one; the schema does not carry it.
 */

const NO_BOOLEANS: ReadonlySet<string> = new Set()

export function getSettings(db: Database): Settings {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Row | undefined
  if (!row) throw new Error('The settings row is missing; migration 001 should have created it')
  return settingsSchema.parse(fromColumns(row, NO_BOOLEANS))
}

/** Merges and re-validates the whole row, then stamps it changed. */
export function updateSettings(db: Database, patch: UpdateSettingsInput): Settings {
  const current = getSettings(db)
  const merged = settingsSchema.parse({
    ...current,
    ...patch,
    updatedAt: bumpedUpdatedAt(current.updatedAt, nowIso()),
    syncState: 'pending'
  })
  const row = toColumns(merged)
  const assignments = Object.keys(row).map((column) => `${column} = @${column}`)
  db.prepare(`UPDATE settings SET ${assignments.join(', ')} WHERE id = 1`).run(row)
  return merged
}
