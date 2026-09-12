import { beforeEach, describe, expect, it } from 'vitest'
import type { SyncPullChanges, SyncPullRow } from '@trackit/shared/schemas'
import { openMemoryDatabase, type Database } from '../db'
import { createChecklistItem, listChecklistItems, updateChecklistItem } from '../repositories/checklist-items'
import { deleteClient, getClient, updateClient } from '../repositories/clients'
import { createInvoice, listInvoiceLines } from '../repositories/invoices'
import { getSettings, updateSettings } from '../repositories/settings'
import { aClient, aProject, id } from '../repositories/test-support'
import { applyChanges } from './apply'
import { listConflicts } from './conflicts'

let db: Database
const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOW = '2026-09-10T12:00:00.000Z'

beforeEach(() => {
  db = openMemoryDatabase()
  db.prepare("UPDATE settings SET sync_state = 'synced'").run()
})

/** A row as the server would send it: the entity minus syncState, plus who wrote it. */
const pulled = <T extends { syncState: string }>(
  entity: T,
  updatedBy: string | null = OTHER,
  patch: Partial<T> = {}
): Omit<T, 'syncState'> & { updatedBy: string | null } => {
  const { syncState: _, ...row } = { ...entity, ...patch }
  return { ...row, updatedBy }
}

const later = (at: string, minutes = 1): string => new Date(Date.parse(at) + minutes * 60_000).toISOString()
const earlier = (at: string, minutes = 1): string => new Date(Date.parse(at) - minutes * 60_000).toISOString()

const apply = (changes: SyncPullChanges) => applyChanges(db, changes, { deviceId: ME, now: NOW })

const rawClient = (rowId: string) => db.prepare('SELECT * FROM clients WHERE id = ?').get(rowId) as Record<string, unknown>
const markSynced = (table: string, rowId: string) => db.prepare(`UPDATE ${table} SET sync_state = 'synced' WHERE id = ?`).run(rowId)

describe('applyChanges: rows this machine has never seen', () => {
  it('inserts them as synced, parents first', () => {
    const other = openMemoryDatabase()
    const client = aClient(other)
    const project = aProject(other, client)

    const result = apply({ clients: [pulled(client)], projects: [pulled(project)] })
    expect(result).toEqual({ applied: 2, conflicts: 0 })
    expect(rawClient(client.id)).toMatchObject({ name: client.name, sync_state: 'synced' })
    expect(db.prepare('SELECT sync_state FROM projects WHERE id = ?').get(project.id)).toEqual({ sync_state: 'synced' })
  })

  it('inserts a tombstone too, so a second machine holds the same history', () => {
    const other = openMemoryDatabase()
    const client = deleteClient(other, aClient(other).id)
    apply({ clients: [pulled(client)] })
    expect(rawClient(client.id)['deleted_at']).toBe(client.deletedAt)
    expect(getClient(db, client.id)).toBeNull()
  })

  it('applies parent tables first whatever order the page lists them in', () => {
    const other = openMemoryDatabase()
    const client = aClient(other)
    const project = aProject(other, client, 'delivered')
    const invoice = createInvoice(other, {
      id: id(),
      clientId: client.id,
      taxRate: 0,
      notes: '',
      lines: [{ id: id(), projectId: project.id, milestoneId: null, sortOrder: 1 }]
    })
    const [line] = listInvoiceLines(other, invoice.id)

    /* Foreign keys are on in this database, so a line written before its
       invoice, or an invoice before its client, would be refused by SQLite.
       The page is built child-first on purpose: the order has to come from
       SYNC_TABLE_ORDER, not from the shape of the object. */
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    const result = apply({
      invoice_lines: [pulled(line!)],
      invoices: [pulled(invoice)],
      projects: [pulled(project)],
      clients: [pulled(client)]
    })
    expect(result).toEqual({ applied: 4, conflicts: 0 })
    expect(listInvoiceLines(db, invoice.id).map((entry) => entry.id)).toEqual([line!.id])
  })
})

describe('applyChanges: over a row the server already gave us', () => {
  it('takes a newer version', () => {
    const client = aClient(db)
    markSynced('clients', client.id)
    const result = apply({ clients: [pulled(client, OTHER, { name: 'Renamed elsewhere', updatedAt: later(client.updatedAt) })] })
    expect(result.applied).toBe(1)
    expect(getClient(db, client.id)?.name).toBe('Renamed elsewhere')
    expect(rawClient(client.id)['sync_state']).toBe('synced')
  })

  it('ignores an older one', () => {
    const client = aClient(db)
    markSynced('clients', client.id)
    const result = apply({ clients: [pulled(client, OTHER, { name: 'Stale', updatedAt: earlier(client.updatedAt) })] })
    expect(result.applied).toBe(0)
    expect(getClient(db, client.id)?.name).toBe(client.name)
  })

  it('does nothing with the same version twice', () => {
    const client = aClient(db)
    markSynced('clients', client.id)
    const changes = { clients: [pulled(client, OTHER, { name: 'Renamed', updatedAt: later(client.updatedAt) })] }
    expect(apply(changes).applied).toBe(1)
    const after = rawClient(client.id)
    expect(apply(changes)).toEqual({ applied: 0, conflicts: 0 })
    expect(rawClient(client.id)).toEqual(after)
    expect(listConflicts(db)).toEqual([])
  })

  it('takes the server’s word at an equal instant: a synced copy has no edit to defend', () => {
    const client = aClient(db)
    markSynced('clients', client.id)
    /* Same updatedAt, different content, from a lesser device id. A pending
       row would win this tie; a synced one does not compete. */
    const lesser = '00000000-0000-4000-8000-000000000000'
    const result = apply({ clients: [pulled(client, lesser, { name: 'What the server holds' })] })
    expect(result).toEqual({ applied: 1, conflicts: 0 })
    expect(getClient(db, client.id)?.name).toBe('What the server holds')
    expect(listConflicts(db)).toEqual([])
  })

  it('a remote delete over a synced row lands silently', () => {
    const client = aClient(db)
    markSynced('clients', client.id)
    const gone = later(client.updatedAt)
    const result = apply({ clients: [pulled(client, OTHER, { deletedAt: gone, updatedAt: gone })] })
    expect(result).toEqual({ applied: 1, conflicts: 0 })
    expect(getClient(db, client.id)).toBeNull()
    expect(rawClient(client.id)).toMatchObject({ deleted_at: gone, sync_state: 'synced' })
  })
})

describe('applyChanges: over a pending local edit', () => {
  it('lets a newer remote version win, records the conflict, and the row is synced', () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'My name', notes: 'my notes' })
    const theirs = pulled(client, OTHER, { name: 'Their name', updatedAt: later(mine.updatedAt) })

    const result = apply({ clients: [theirs] })
    expect(result).toEqual({ applied: 1, conflicts: 1 })
    expect(rawClient(client.id)).toMatchObject({ name: 'Their name', notes: '', sync_state: 'synced' })

    const [conflict] = listConflicts(db)
    expect(conflict).toMatchObject({
      table: 'clients',
      rowId: client.id,
      kind: 'record',
      projectId: null,
      label: 'My name',
      fields: ['name', 'notes'],
      localDeletedAt: null,
      remoteDeletedAt: null,
      detectedAt: NOW
    })
  })

  it('keeps a pending edit that is newer than the remote version, untouched', () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'My name' })
    const theirs = pulled(client, OTHER, { name: 'Their name', updatedAt: earlier(mine.updatedAt) })

    expect(apply({ clients: [theirs] })).toEqual({ applied: 0, conflicts: 0 })
    expect(rawClient(client.id)).toMatchObject({ name: 'My name', sync_state: 'pending', updated_at: mine.updatedAt })
    expect(listConflicts(db)).toEqual([])
  })

  it('takes its own echo as confirmation: synced, no conflict', () => {
    const client = aClient(db)
    const echo = pulled(client, ME)
    expect(apply({ clients: [echo] })).toEqual({ applied: 0, conflicts: 0 })
    expect(rawClient(client.id)).toMatchObject({ name: client.name, sync_state: 'synced' })
    expect(listConflicts(db)).toEqual([])
  })

  it('breaks an equal updatedAt by device id, the way the server does', () => {
    const client = aClient(db)
    const fromGreater = pulled(client, OTHER, { name: 'B wrote this' })
    expect(apply({ clients: [fromGreater] })).toEqual({ applied: 1, conflicts: 1 })
    expect(getClient(db, client.id)?.name).toBe('B wrote this')

    const second = aClient(db, { id: id(), name: 'Second' })
    const fromLesser = pulled(second, '00000000-0000-4000-8000-000000000000', { name: 'Lesser wrote this' })
    expect(apply({ clients: [fromLesser] })).toEqual({ applied: 0, conflicts: 0 })
    expect(getClient(db, second.id)?.name).toBe('Second')
  })

  it('records no conflict when the two versions say the same thing', () => {
    const client = aClient(db)
    const same = pulled(client, OTHER, { updatedAt: later(client.updatedAt) })
    expect(apply({ clients: [same] })).toEqual({ applied: 1, conflicts: 0 })
    expect(rawClient(client.id)['sync_state']).toBe('synced')
  })

  it('a version with no device of record never wins a tie against a pending edit', () => {
    const client = aClient(db)
    const unsigned = pulled(client, null, { name: 'Written before devices had ids' })
    expect(apply({ clients: [unsigned] })).toEqual({ applied: 0, conflicts: 0 })
    expect(rawClient(client.id)).toMatchObject({ name: client.name, sync_state: 'pending' })
    expect(listConflicts(db)).toEqual([])
  })

  it('applying the page that caused a conflict again records nothing twice', () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'My name' })
    const changes = { clients: [pulled(client, OTHER, { name: 'Their name', updatedAt: later(mine.updatedAt) })] }
    expect(apply(changes)).toEqual({ applied: 1, conflicts: 1 })
    /* What a relaunch after a crash between the commit and the cursor write
       would do: the same page, over a row that is now synced at that version. */
    expect(apply(changes)).toEqual({ applied: 0, conflicts: 0 })
    expect(listConflicts(db)).toHaveLength(1)
  })
})

describe('applyChanges: deletes', () => {
  it('a local edit lost to a remote delete: the row is gone here too, and the conflict says so', () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'Edited here' })
    const deletedThere = later(mine.updatedAt)
    apply({ clients: [pulled(client, OTHER, { deletedAt: deletedThere, updatedAt: deletedThere })] })

    expect(getClient(db, client.id)).toBeNull()
    const [conflict] = listConflicts(db)
    expect(conflict).toMatchObject({ kind: 'record', localDeletedAt: null, remoteDeletedAt: deletedThere })
    expect(conflict?.fields).toEqual(expect.arrayContaining(['name', 'deletedAt']))
  })

  it('a local delete lost to a remote edit: the row comes back, and the conflict says so', () => {
    const client = aClient(db)
    markSynced('clients', client.id)
    const mine = deleteClient(db, client.id)
    apply({ clients: [pulled(client, OTHER, { name: 'Edited there', updatedAt: later(mine.updatedAt) })] })

    expect(getClient(db, client.id)?.name).toBe('Edited there')
    const [conflict] = listConflicts(db)
    expect(conflict).toMatchObject({ kind: 'record', localDeletedAt: mine.deletedAt, remoteDeletedAt: null })
  })

  it('a local delete that loses to a later remote edit keeps the local tombstone’s time on the conflict', () => {
    const client = aClient(db)
    markSynced('clients', client.id)
    const mine = deleteClient(db, client.id)
    const theirsAt = later(mine.updatedAt)
    apply({ clients: [pulled(client, OTHER, { name: 'Edited there', updatedAt: theirsAt })] })
    /* The row now carries the remote version outright: alive, at their time, synced. */
    expect(rawClient(client.id)).toMatchObject({ deleted_at: null, updated_at: theirsAt, sync_state: 'synced' })
    expect(listConflicts(db)[0]?.fields).toEqual(expect.arrayContaining(['deletedAt', 'name']))
  })

  /*
   * BUG (apply.ts:96-110): two devices deleting the same row is not a
   * disagreement, but differingFields() counts `deletedAt` like any other
   * field, so the device whose tombstone is older is told "edited on two
   * devices; the other version was kept" about a row both sides removed —
   * and offered a Restore that would restore its own delete.
   */
  it('a delete on both sides is not a conflict: the row is gone, and nobody is told', () => {
    const client = aClient(db)
    markSynced('clients', client.id)
    const mine = deleteClient(db, client.id)
    const theirsAt = later(mine.updatedAt)
    const result = apply({ clients: [pulled(client, OTHER, { deletedAt: theirsAt, updatedAt: theirsAt })] })
    expect(getClient(db, client.id)).toBeNull()
    expect(rawClient(client.id)['sync_state']).toBe('synced')
    expect(result.conflicts).toBe(0)
    expect(listConflicts(db)).toEqual([])
  })
})

describe('applyChanges: the checklist', () => {
  it('a lost move is a reorder conflict, grouped by project', () => {
    const client = aClient(db)
    const project = aProject(db, client)
    const item = createChecklistItem(db, { id: id(), projectId: project.id, label: 'Logo', done: false, sortOrder: 1 })
    const mine = updateChecklistItem(db, item.id, { sortOrder: 5 })
    apply({ checklist_items: [pulled(item, OTHER, { sortOrder: 0.5, updatedAt: later(mine.updatedAt) })] })

    expect(listChecklistItems(db, project.id)[0]?.sortOrder).toBe(0.5)
    expect(listConflicts(db)[0]).toMatchObject({ kind: 'reorder', projectId: project.id, fields: ['sortOrder'], label: 'Logo' })
  })

  it('a lost move that also changed the label is a record conflict', () => {
    const client = aClient(db)
    const project = aProject(db, client)
    const item = createChecklistItem(db, { id: id(), projectId: project.id, label: 'Logo', done: false, sortOrder: 1 })
    const mine = updateChecklistItem(db, item.id, { sortOrder: 5, label: 'Logotype' })
    apply({ checklist_items: [pulled(item, OTHER, { sortOrder: 0.5, updatedAt: later(mine.updatedAt) })] })
    expect(listConflicts(db)[0]).toMatchObject({ kind: 'record', fields: ['label', 'sortOrder'] })
  })
})

describe('applyChanges: settings', () => {
  it('writes the account’s settings over the row and leaves the machine’s own fields alone', () => {
    updateSettings(db, { theme: 'dark', accountEmail: 'alex@trackit.studio' })
    db.prepare("UPDATE settings SET sync_state = 'synced'").run()
    const current = getSettings(db)
    const { theme: _t, accountEmail: _a, syncState: _s, ...wire } = current
    const incoming: SyncPullRow<'settings'> = { ...wire, person: 'Alexandra', updatedAt: later(current.updatedAt), updatedBy: OTHER }

    expect(apply({ settings: [incoming] })).toEqual({ applied: 1, conflicts: 0 })
    const after = getSettings(db)
    expect(after).toMatchObject({ person: 'Alexandra', theme: 'dark', accountEmail: 'alex@trackit.studio', syncState: 'synced' })
  })

  it('a lost settings edit is a conflict labelled Settings', () => {
    const mine = updateSettings(db, { person: 'Mine' })
    const { theme: _t, accountEmail: _a, syncState: _s, ...wire } = mine
    apply({ settings: [{ ...wire, person: 'Theirs', updatedAt: later(mine.updatedAt), updatedBy: OTHER } as SyncPullRow<'settings'>] })
    expect(getSettings(db).person).toBe('Theirs')
    expect(listConflicts(db)[0]).toMatchObject({ table: 'settings', rowId: '', label: 'Settings', fields: ['person'] })
  })
})
