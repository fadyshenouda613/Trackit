import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from '../db'
import { updateClient } from './clients'
import { updateSettings } from './settings'
import { bumpedUpdatedAt } from './table'
import { aClient } from './test-support'

let db: Database
beforeEach(() => {
  db = openMemoryDatabase()
})

const FUTURE = '2099-01-01T00:00:00.000Z'

describe('bumpedUpdatedAt', () => {
  it('is now when now is later than the row', () => {
    expect(bumpedUpdatedAt('2026-09-10T09:00:00.000Z', '2026-09-10T09:00:01.000Z')).toBe('2026-09-10T09:00:01.000Z')
  })

  it('is one millisecond past the row when the clock is behind it', () => {
    expect(bumpedUpdatedAt('2026-09-10T09:00:01.000Z', '2026-09-10T09:00:00.000Z')).toBe('2026-09-10T09:00:01.001Z')
    expect(bumpedUpdatedAt('2026-09-10T09:00:01.000Z', '2026-09-10T09:00:01.000Z')).toBe('2026-09-10T09:00:01.001Z')
  })
})

describe('an edit on top of a version from a clock ahead of ours', () => {
  it('still stamps a newer updatedAt on a row', () => {
    const client = aClient(db)
    db.prepare('UPDATE clients SET updated_at = ? WHERE id = ?').run(FUTURE, client.id)
    const edited = updateClient(db, client.id, { name: 'Renamed' })
    expect(edited.updatedAt).toBe('2099-01-01T00:00:00.001Z')
  })

  it('still stamps a newer updatedAt on the settings row', () => {
    db.prepare('UPDATE settings SET updated_at = ?').run(FUTURE)
    expect(updateSettings(db, { person: 'Alex' }).updatedAt).toBe('2099-01-01T00:00:00.001Z')
  })
})
