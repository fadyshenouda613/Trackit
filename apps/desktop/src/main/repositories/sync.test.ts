import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from '../db'
import { pendingCounts } from './sync'
import { updateSettings } from './settings'
import { createChecklistItem } from './checklist-items'
import { deleteClient } from './clients'
import { createNote } from './notes'
import { collectPending } from '../sync/outbox'
import { aClient, aProject, id } from './test-support'

let db: Database
beforeEach(() => {
  db = openMemoryDatabase()
})

describe('pendingCounts', () => {
  it('counts local writes the server has not seen, by bucket', () => {
    const client = aClient(db)
    aProject(db, client, 'active')
    updateSettings(db, { person: 'Alex' })
    expect(pendingCounts(db)).toEqual({ clients: 1, projects: 1, settings: 1 })
  })

  it("counts a project's checklist, milestones and notes under projects", () => {
    const client = aClient(db)
    const project = aProject(db, client)
    createChecklistItem(db, { id: id(), projectId: project.id, label: 'Logo', done: false, sortOrder: 1 })
    createNote(db, { id: id(), projectId: project.id, clientId: null, body: 'Kickoff went well', pinned: false })
    expect(pendingCounts(db)).toEqual({ clients: 1, projects: 3 })
  })

  it('leaves out buckets with nothing pending and ignores synced rows', () => {
    const client = aClient(db)
    const project = aProject(db, client)
    db.prepare("UPDATE projects SET sync_state = 'synced' WHERE id = ?").run(project.id)
    db.prepare("UPDATE clients SET sync_state = 'synced' WHERE id = ?").run(client.id)
    db.prepare("UPDATE settings SET sync_state = 'synced'").run()
    expect(pendingCounts(db)).toEqual({})
  })

  /*
   * BUG (repositories/sync.ts:19): countPending filters on `deleted_at IS
   * NULL`, so a delete made offline is in the outbox but not in the counts.
   * The footer then reads "saved" while a tombstone waits to go up, which
   * the pending-counts schema promises never happens ("nothing waiting" is
   * never said while a row waits).
   */
  it('counts a delete that has not gone up: a tombstone waits like any other row', () => {
    const client = aClient(db)
    db.prepare("UPDATE clients SET sync_state = 'synced' WHERE id = ?").run(client.id)
    db.prepare("UPDATE settings SET sync_state = 'synced'").run()
    deleteClient(db, client.id)
    expect(collectPending(db, 500).pushed).toEqual([{ table: 'clients', id: client.id, updatedAt: expect.any(String) }])
    expect(pendingCounts(db)).toEqual({ clients: 1 })
  })
})
