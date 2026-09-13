import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from '../db'
import { createChecklistItem, listChecklistItems, updateChecklistItem } from '../repositories/checklist-items'
import { deleteClient, getClient, updateClient } from '../repositories/clients'
import { aClient, aProject, id } from '../repositories/test-support'
import { applyChanges } from './apply'
import { listConflicts, listEvents, recordEvent, resolveConflict } from './conflicts'

let db: Database
const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOW = '2026-09-10T12:00:00.000Z'
const LATER = '2026-09-10T12:05:00.000Z'

beforeEach(() => {
  db = openMemoryDatabase()
  db.prepare("UPDATE settings SET sync_state = 'synced'").run()
})

const pulled = <T extends { syncState: string }>(
  entity: T,
  patch: Partial<T> = {}
): Omit<T, 'syncState'> & { updatedBy: string | null } => {
  const { syncState: _, ...row } = { ...entity, ...patch }
  return { ...row, updatedBy: OTHER }
}
const later = (at: string): string => new Date(Date.parse(at) + 60_000).toISOString()
const rawClient = (rowId: string) => db.prepare('SELECT * FROM clients WHERE id = ?').get(rowId) as Record<string, unknown>

describe('resolveConflict', () => {
  it('keepTheirs closes the conflict and changes nothing', () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'Mine' })
    applyChanges(db, { clients: [pulled(client, { name: 'Theirs', updatedAt: later(mine.updatedAt) })] }, { deviceId: ME, now: NOW })
    const [conflict] = listConflicts(db)

    resolveConflict(db, conflict!.id, 'keepTheirs', LATER)
    expect(listConflicts(db)).toEqual([])
    expect(rawClient(client.id)).toMatchObject({ name: 'Theirs', sync_state: 'synced' })
  })

  it('restoreMine writes my version back as a fresh pending edit that outranks theirs', () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'Mine', notes: 'kept' })
    const theirsAt = later(mine.updatedAt)
    applyChanges(db, { clients: [pulled(client, { name: 'Theirs', updatedAt: theirsAt })] }, { deviceId: ME, now: NOW })
    const [conflict] = listConflicts(db)

    resolveConflict(db, conflict!.id, 'restoreMine', LATER)
    const row = rawClient(client.id)
    expect(row).toMatchObject({ name: 'Mine', notes: 'kept', sync_state: 'pending' })
    expect(Date.parse(row['updated_at'] as string)).toBeGreaterThan(Date.parse(theirsAt))
    expect(listConflicts(db)).toEqual([])
  })

  it('restoreMine after a remote delete brings the row back', () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'Mine' })
    const gone = later(mine.updatedAt)
    applyChanges(db, { clients: [pulled(client, { deletedAt: gone, updatedAt: gone })] }, { deviceId: ME, now: NOW })
    expect(getClient(db, client.id)).toBeNull()

    resolveConflict(db, listConflicts(db)[0]!.id, 'restoreMine', LATER)
    expect(getClient(db, client.id)?.name).toBe('Mine')
  })

  it('restoreMine after a remote edit restores my delete', () => {
    const client = aClient(db)
    db.prepare("UPDATE clients SET sync_state = 'synced' WHERE id = ?").run(client.id)
    const mine = deleteClient(db, client.id)
    applyChanges(db, { clients: [pulled(client, { name: 'Theirs', updatedAt: later(mine.updatedAt) })] }, { deviceId: ME, now: NOW })
    expect(getClient(db, client.id)?.name).toBe('Theirs')

    resolveConflict(db, listConflicts(db)[0]!.id, 'restoreMine', LATER)
    expect(getClient(db, client.id)).toBeNull()
    expect(rawClient(client.id)['sync_state']).toBe('pending')
  })

  it('restoreMine on a reorder puts only the position back', () => {
    const client = aClient(db)
    const project = aProject(db, client)
    const item = createChecklistItem(db, { id: id(), projectId: project.id, label: 'Logo', done: false, sortOrder: 1 })
    const mine = updateChecklistItem(db, item.id, { sortOrder: 5 })
    applyChanges(
      db,
      { checklist_items: [pulled(item, { sortOrder: 0.5, label: 'Renamed there', updatedAt: later(mine.updatedAt) })] },
      { deviceId: ME, now: NOW }
    )
    /* A label and a position: a record conflict. Restore all of mine. */
    expect(listConflicts(db)[0]?.kind).toBe('record')

    /* Now a pure move that lost. */
    const second = createChecklistItem(db, { id: id(), projectId: project.id, label: 'Type', done: false, sortOrder: 2 })
    const moved = updateChecklistItem(db, second.id, { sortOrder: 9 })
    applyChanges(
      db,
      { checklist_items: [pulled(second, { sortOrder: 0.25, updatedAt: later(moved.updatedAt) })] },
      { deviceId: ME, now: NOW }
    )
    const reorder = listConflicts(db).find((conflict) => conflict.kind === 'reorder')
    resolveConflict(db, reorder!.id, 'restoreMine', LATER)
    const items = listChecklistItems(db, project.id)
    expect(items.find((entry) => entry.id === second.id)).toMatchObject({ sortOrder: 9, label: 'Type', syncState: 'pending' })
  })

  it('refuses an unknown or already resolved conflict', () => {
    expect(() => resolveConflict(db, id(), 'keepTheirs', LATER)).toThrow()

    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'Mine' })
    applyChanges(db, { clients: [pulled(client, { name: 'Theirs', updatedAt: later(mine.updatedAt) })] }, { deviceId: ME, now: NOW })
    const [conflict] = listConflicts(db)
    resolveConflict(db, conflict!.id, 'keepTheirs', LATER)
    /* A second Restore on a closed conflict would write a stale version back as a fresh edit. */
    expect(() => resolveConflict(db, conflict!.id, 'restoreMine', LATER)).toThrow()
    expect(rawClient(client.id)).toMatchObject({ name: 'Theirs', sync_state: 'synced' })
  })

  it('restoreMine stamps the edit past the winner even when this machine’s clock is behind it', () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'Mine' })
    const theirsAt = later(mine.updatedAt)
    applyChanges(db, { clients: [pulled(client, { name: 'Theirs', updatedAt: theirsAt })] }, { deviceId: ME, now: NOW })

    const behind = new Date(Date.parse(theirsAt) - 60_000).toISOString()
    resolveConflict(db, listConflicts(db)[0]!.id, 'restoreMine', behind)
    const restoredAt = rawClient(client.id)['updated_at'] as string
    /* One millisecond past the winner: enough to win the tie-break everywhere, and no further. */
    expect(Date.parse(restoredAt)).toBe(Date.parse(theirsAt) + 1)
  })

  it('lists open conflicts newest first and leaves resolved ones out', () => {
    const first = aClient(db, { name: 'First' })
    const second = aClient(db, { name: 'Second' })
    const mineFirst = updateClient(db, first.id, { name: 'Mine 1' })
    const mineSecond = updateClient(db, second.id, { name: 'Mine 2' })
    applyChanges(db, { clients: [pulled(first, { name: 'Theirs 1', updatedAt: later(mineFirst.updatedAt) })] }, { deviceId: ME, now: NOW })
    applyChanges(db, { clients: [pulled(second, { name: 'Theirs 2', updatedAt: later(mineSecond.updatedAt) })] }, { deviceId: ME, now: LATER })

    expect(listConflicts(db).map((conflict) => conflict.label)).toEqual(['Mine 2', 'Mine 1'])
    resolveConflict(db, listConflicts(db)[0]!.id, 'keepTheirs', LATER)
    expect(listConflicts(db).map((conflict) => conflict.label)).toEqual(['Mine 1'])
  })
})

describe('the event log', () => {
  it('lists newest first and keeps the last fifty', () => {
    for (let n = 0; n < 60; n += 1) {
      recordEvent(db, 'synced', `${n} changes uploaded`, new Date(Date.parse(NOW) + n * 1000).toISOString())
    }
    const events = listEvents(db, 20)
    expect(events).toHaveLength(20)
    expect(events[0]?.detail).toBe('59 changes uploaded')
    expect((db.prepare('SELECT COUNT(*) AS n FROM sync_events').get() as { n: number }).n).toBe(50)
  })

  it('writes a conflict event when a conflict is recorded', () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'Mine' })
    applyChanges(db, { clients: [pulled(client, { name: 'Theirs', updatedAt: later(mine.updatedAt) })] }, { deviceId: ME, now: NOW })
    expect(listEvents(db, 5)[0]).toMatchObject({ kind: 'conflict', at: NOW })
    expect(listEvents(db, 5)[0]?.detail).toContain('Mine')
  })
})
