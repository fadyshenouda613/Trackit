import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from '../db'
import { pendingCounts } from './sync'
import { updateSettings } from './settings'
import { aClient, aProject } from './test-support'

let db: Database
beforeEach(() => {
  db = openMemoryDatabase()
})

describe('pendingCounts', () => {
  it('counts local writes the server has not seen, by bucket', () => {
    const client = aClient(db)
    aProject(db, client, 'active')
    updateSettings(db, { person: 'Alex' })
    expect(pendingCounts(db)).toEqual({ projects: 1, settings: 1 })
  })

  it('leaves out buckets with nothing pending and ignores synced rows', () => {
    const client = aClient(db)
    const project = aProject(db, client)
    db.prepare("UPDATE projects SET sync_state = 'synced' WHERE id = ?").run(project.id)
    db.prepare("UPDATE settings SET sync_state = 'synced'").run()
    expect(pendingCounts(db)).toEqual({})
  })
})
