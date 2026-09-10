import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from '../db'
import { createChecklistItem } from '../repositories/checklist-items'
import { updateClient } from '../repositories/clients'
import { updateSettings } from '../repositories/settings'
import { aClient, aProject, id } from '../repositories/test-support'
import { collectPending, markSynced } from './outbox'

let db: Database
beforeEach(() => {
  db = openMemoryDatabase()
})

const syncStateOf = (table: string, rowId: string): string =>
  (db.prepare(`SELECT sync_state FROM ${table} WHERE id = ?`).get(rowId) as { sync_state: string }).sync_state

describe('collectPending', () => {
  it('gathers pending rows parent tables first, without their sync state', () => {
    const client = aClient(db)
    const project = aProject(db, client)
    const item = createChecklistItem(db, { id: id(), projectId: project.id, label: 'Logo', done: false, sortOrder: 1 })

    const outbox = collectPending(db, 500)
    expect(Object.keys(outbox.changes)).toEqual(['clients', 'projects', 'checklist_items'])
    expect(outbox.changes.clients?.[0]).not.toHaveProperty('syncState')
    expect(outbox.changes.checklist_items?.[0]).toMatchObject({ id: item.id, label: 'Logo', done: false })
    expect(outbox.more).toBe(false)
    expect(outbox.pushed).toEqual([
      { table: 'clients', id: client.id, updatedAt: client.updatedAt },
      { table: 'projects', id: project.id, updatedAt: project.updatedAt },
      { table: 'checklist_items', id: item.id, updatedAt: item.updatedAt }
    ])
  })

  it('leaves synced rows behind', () => {
    const client = aClient(db)
    db.prepare("UPDATE clients SET sync_state = 'synced' WHERE id = ?").run(client.id)
    expect(collectPending(db, 500)).toEqual({ changes: {}, pushed: [], more: false })
  })

  it('stops at the cap and says there is more', () => {
    const client = aClient(db)
    aProject(db, client)
    aProject(db, client)

    const outbox = collectPending(db, 2)
    expect(outbox.pushed).toHaveLength(2)
    expect(outbox.changes.clients).toHaveLength(1)
    expect(outbox.changes.projects).toHaveLength(1)
    expect(outbox.more).toBe(true)

    /* An exact fit is not "more". */
    expect(collectPending(db, 3).more).toBe(false)
  })

  it('sends the settings row without the machine-local fields, and remembers it by an empty id', () => {
    const settings = updateSettings(db, { person: 'Alex', theme: 'dark', accountEmail: 'alex@trackit.studio' })
    const outbox = collectPending(db, 500)
    expect(outbox.changes.settings).toEqual([
      expect.objectContaining({ person: 'Alex', updatedAt: settings.updatedAt })
    ])
    expect(outbox.changes.settings?.[0]).not.toHaveProperty('theme')
    expect(outbox.changes.settings?.[0]).not.toHaveProperty('accountEmail')
    expect(outbox.changes.settings?.[0]).not.toHaveProperty('id')
    expect(outbox.pushed).toEqual([{ table: 'settings', id: '', updatedAt: settings.updatedAt }])
  })

  it('includes deleted rows: a tombstone is a change too', () => {
    const client = aClient(db)
    db.prepare("UPDATE clients SET deleted_at = updated_at WHERE id = ?").run(client.id)
    expect(collectPending(db, 500).changes.clients?.[0]?.deletedAt).toBe(client.updatedAt)
  })
})

describe('markSynced', () => {
  it('marks the rows that went up, by the version that went up', () => {
    const client = aClient(db)
    const outbox = collectPending(db, 500)
    markSynced(db, outbox.pushed, new Set())
    expect(syncStateOf('clients', client.id)).toBe('synced')
  })

  it('leaves a row edited while the request was in flight pending', () => {
    const client = aClient(db)
    const outbox = collectPending(db, 500)
    updateClient(db, client.id, { name: 'Edited meanwhile' })
    markSynced(db, outbox.pushed, new Set())
    expect(syncStateOf('clients', client.id)).toBe('pending')
  })

  it('skips the rows it is told to', () => {
    const client = aClient(db)
    const project = aProject(db, client)
    const outbox = collectPending(db, 500)
    markSynced(db, outbox.pushed, new Set([`projects:${project.id}`]))
    expect(syncStateOf('clients', client.id)).toBe('synced')
    expect(syncStateOf('projects', project.id)).toBe('pending')
  })

  it('marks the settings row too', () => {
    updateSettings(db, { person: 'Alex' })
    const outbox = collectPending(db, 500)
    markSynced(db, outbox.pushed, new Set())
    expect((db.prepare('SELECT sync_state FROM settings').get() as { sync_state: string }).sync_state).toBe('synced')
  })
})
