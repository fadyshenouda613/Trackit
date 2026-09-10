import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createChecklistItem, listChecklistItems, updateChecklistItem } from '../../apps/desktop/src/main/repositories/checklist-items'
import { createClient, deleteClient, getClient, updateClient } from '../../apps/desktop/src/main/repositories/clients'
import { createNote } from '../../apps/desktop/src/main/repositories/notes'
import { createProject, getProject, updateProject } from '../../apps/desktop/src/main/repositories/projects'
import { updateSettings } from '../../apps/desktop/src/main/repositories/settings'
import { createTimeEntry } from '../../apps/desktop/src/main/repositories/time-entries'
import { id } from '../../apps/desktop/src/main/repositories/test-support'
import { cursor } from '../../apps/desktop/src/main/sync/meta'
import { Clock, createDevice, expectSameLedger, ledgerOf, serverRows, startServer, type Device, type TestServer } from './harness'

/*
 * Two devices, one server: the scenarios the sync engine exists to get
 * right. Each one drives two real engines over two in-memory ledgers
 * against the real server, and ends by checking both ledgers are the same
 * row for row with nothing left to upload.
 *
 *   1. concurrent edits to one record
 *   2. concurrent checklist reordering
 *   3. delete versus edit, both ways
 *   4. a long-offline client, and a second machine hydrating from nothing
 *   5. a crash in the middle of a sync, and recovery
 *
 * The clock is stepped by hand between edits (see Clock in the harness),
 * so which edit is newer is a fact of the scenario and not of the machine.
 */

let server: TestServer
let clock: Clock

beforeAll(async () => {
  clock = new Clock()
  server = await startServer({ pageSize: 5 })
})
afterAll(async () => {
  clock.restore()
  await server.close()
})
beforeEach(async () => {
  clock = new Clock()
  await server.reset()
})
afterEach(() => {
  clock.restore()
})

/* ---- Fixtures ------------------------------------------------------------------ */

const aClient = (device: Device, overrides: Partial<{ id: string; name: string }> = {}) =>
  createClient(device.db, {
    id: overrides.id ?? id(),
    name: overrides.name ?? 'Studio Nord',
    company: '',
    email: '',
    phone: '',
    address: '',
    currency: 'EUR',
    paymentTermsDays: 14,
    notes: ''
  })

const aProject = (device: Device, clientId: string, overrides: Partial<{ id: string; name: string }> = {}) =>
  createProject(device.db, {
    id: overrides.id ?? id(),
    clientId,
    name: overrides.name ?? 'Brand refresh',
    description: '',
    priceCents: 650000,
    currency: 'EUR',
    budgetedHours: 32,
    status: 'draft',
    kickoffAt: null,
    dueAt: null,
    deliveredAt: null
  })

const anItem = (device: Device, projectId: string, label: string, sortOrder: number, itemId = id()) =>
  createChecklistItem(device.db, { id: itemId, projectId, label, done: false, sortOrder })

/** A and B, with B holding whatever A had made before. */
async function twoDevicesInStep(): Promise<{ a: Device; b: Device }> {
  const a = await createDevice(server, 'A')
  const b = await createDevice(server, 'B')
  return { a, b }
}

const orderOn = (device: Device, projectId: string): string[] =>
  listChecklistItems(device.db, projectId).map((item) => item.label)

/* ---- 1. Concurrent edits to one record ---------------------------------------- */

describe('1. concurrent edits to one record', () => {
  it('the later edit wins on both devices; the device whose edit lost is told', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    const project = aProject(a, client.id)
    await a.sync()
    await b.sync()
    expectSameLedger(a, b)

    /* Both offline. A changes the price first; B changes the due date later. */
    clock.tick()
    updateProject(a.db, project.id, { priceCents: 700000 })
    clock.tick()
    const bs = updateProject(b.db, project.id, { dueAt: '2026-10-01T00:00:00.000Z' })

    /* B reaches the server first, then A. A's older edit loses. */
    await b.sync()
    const status = await a.sync()

    expectSameLedger(a, b)
    expect(getProject(a.db, project.id)).toMatchObject({ priceCents: 650000, dueAt: '2026-10-01T00:00:00.000Z' })
    expect(getProject(a.db, project.id)?.updatedAt).toBe(bs.updatedAt)

    const [conflict] = a.engine.conflicts()
    expect(conflict).toMatchObject({ table: 'projects', rowId: project.id, kind: 'record', label: 'Brand refresh' })
    expect(conflict?.fields).toEqual(['dueAt', 'priceCents'])
    expect(b.engine.conflicts()).toEqual([])
    expect(status.log.some((entry) => entry.kind === 'conflict')).toBe(true)

    /* A wants its price back: a fresh edit that outranks B's, and B takes it. */
    clock.tick()
    a.engine.resolveConflict(conflict!.id, 'restoreMine')
    await a.sync()
    await b.sync()
    expectSameLedger(a, b)
    expect(getProject(b.db, project.id)).toMatchObject({ priceCents: 700000, dueAt: null })
  })

  it('the same edits in the other order converge the same way, with no conflict to report', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    const project = aProject(a, client.id)
    await a.sync()
    await b.sync()

    clock.tick()
    updateProject(a.db, project.id, { priceCents: 700000 })
    clock.tick()
    updateProject(b.db, project.id, { dueAt: '2026-10-01T00:00:00.000Z' })

    /* A first this time: its edit is accepted, then B's newer one replaces it. */
    await a.sync()
    await b.sync()
    await a.sync()

    expectSameLedger(a, b)
    expect(getProject(a.db, project.id)).toMatchObject({ priceCents: 650000, dueAt: '2026-10-01T00:00:00.000Z' })
    /* A's edit did not lose at the server; it was simply edited again after. */
    expect(a.engine.conflicts()).toEqual([])
    expect(b.engine.conflicts()).toEqual([])
  })

  it('an equal instant is broken by device id, identically on both sides', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    await a.sync()
    await b.sync()

    clock.tick()
    updateClient(a.db, client.id, { name: 'A wrote this' })
    updateClient(b.db, client.id, { name: 'B wrote this' })

    await a.sync()
    await b.sync()
    await a.sync()
    expectSameLedger(a, b)

    const winner = getClient(a.db, client.id)?.name
    expect(['A wrote this', 'B wrote this']).toContain(winner)
    /* The greater device id wins whichever synced first. The loser is told
       when its push was the one turned away; when its push was accepted
       and the winner arrived afterwards, the row was already synced and
       the replacement reads as a later edit — as in the ordering case
       above. Never more than one notice, and never on the winner. */
    expect(a.engine.conflicts().length + b.engine.conflicts().length).toBeLessThanOrEqual(1)
    const winningDevice = winner === 'A wrote this' ? a : b
    expect(winningDevice.engine.conflicts()).toEqual([])
  })
})

/* ---- 2. Concurrent checklist reordering ------------------------------------- */

describe('2. concurrent checklist reordering', () => {
  it('moves of different items merge with nothing lost and nothing to report', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    const project = aProject(a, client.id)
    anItem(a, project.id, 'Logo', 1)
    anItem(a, project.id, 'Type', 2)
    anItem(a, project.id, 'Colour', 3)
    await a.sync()
    await b.sync()
    expect(orderOn(b, project.id)).toEqual(['Logo', 'Type', 'Colour'])

    const [logo, , colour] = listChecklistItems(a.db, project.id)
    /* A drags Logo to the bottom; B drags Colour to the top. */
    clock.tick()
    updateChecklistItem(a.db, logo!.id, { sortOrder: 4 })
    clock.tick()
    updateChecklistItem(b.db, colour!.id, { sortOrder: 0.5 })

    await a.sync()
    await b.sync()
    await a.sync()

    expectSameLedger(a, b)
    expect(orderOn(a, project.id)).toEqual(['Colour', 'Type', 'Logo'])
    expect(a.engine.conflicts()).toEqual([])
    expect(b.engine.conflicts()).toEqual([])
  })

  it('the same item moved on both ends up where the later move put it, and the other device sees a reorder', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    const project = aProject(a, client.id)
    anItem(a, project.id, 'Logo', 1)
    anItem(a, project.id, 'Type', 2)
    anItem(a, project.id, 'Colour', 3)
    await a.sync()
    await b.sync()

    const [, type] = listChecklistItems(a.db, project.id)
    clock.tick()
    updateChecklistItem(a.db, type!.id, { sortOrder: 4 }) // A: Type to the bottom
    clock.tick()
    updateChecklistItem(b.db, type!.id, { sortOrder: 0.5 }) // B, later: Type to the top

    await b.sync()
    await a.sync()

    expectSameLedger(a, b)
    expect(orderOn(a, project.id)).toEqual(['Type', 'Logo', 'Colour'])
    expect(orderOn(b, project.id)).toEqual(['Type', 'Logo', 'Colour'])

    const [conflict] = a.engine.conflicts()
    expect(conflict).toMatchObject({ kind: 'reorder', projectId: project.id, label: 'Type', fields: ['sortOrder'] })
    expect(b.engine.conflicts()).toEqual([])

    /* A insists on its order: only the position travels, and B follows. */
    clock.tick()
    a.engine.resolveConflict(conflict!.id, 'restoreMine')
    await a.sync()
    await b.sync()
    expectSameLedger(a, b)
    expect(orderOn(b, project.id)).toEqual(['Logo', 'Colour', 'Type'])
  })
})

/* ---- 3. Delete versus edit ----------------------------------------------------- */

describe('3. delete versus edit', () => {
  it('a delete loses to a later edit: the row lives on both devices, and the deleter is told', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    await a.sync()
    await b.sync()

    clock.tick()
    const deleted = deleteClient(a.db, client.id)
    clock.tick()
    updateClient(b.db, client.id, { name: 'Renamed on B' })

    await b.sync()
    await a.sync()

    expectSameLedger(a, b)
    expect(getClient(a.db, client.id)?.name).toBe('Renamed on B')
    expect(getClient(b.db, client.id)?.name).toBe('Renamed on B')
    expect(a.engine.conflicts()[0]).toMatchObject({
      table: 'clients',
      localDeletedAt: deleted.deletedAt,
      remoteDeletedAt: null
    })
  })

  it('an edit loses to a later delete: the row is gone on both devices, and the editor is told', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    await a.sync()
    await b.sync()

    clock.tick()
    updateClient(a.db, client.id, { name: 'Renamed on A' })
    clock.tick()
    const deleted = deleteClient(b.db, client.id)

    await b.sync()
    await a.sync()

    expectSameLedger(a, b)
    expect(getClient(a.db, client.id)).toBeNull()
    expect(getClient(b.db, client.id)).toBeNull()
    const [conflict] = a.engine.conflicts()
    expect(conflict).toMatchObject({ localDeletedAt: null, remoteDeletedAt: deleted.deletedAt })

    /* Restoring the edit brings the client back everywhere. */
    clock.tick()
    a.engine.resolveConflict(conflict!.id, 'restoreMine')
    await a.sync()
    await b.sync()
    expectSameLedger(a, b)
    expect(getClient(b.db, client.id)?.name).toBe('Renamed on A')
  })

  it('a delete that reaches the server first simply wins over an older edit', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    await a.sync()
    await b.sync()

    clock.tick()
    updateClient(a.db, client.id, { name: 'Renamed on A' })
    clock.tick()
    deleteClient(b.db, client.id)

    await b.sync()
    await a.sync()
    expectSameLedger(a, b)
    expect(getClient(a.db, client.id)).toBeNull()
  })
})

/* ---- 4. A long-offline client ------------------------------------------------- */

describe('4. a long-offline client', () => {
  it('a second machine hydrates the whole history from since 0, page by page', async () => {
    const a = await createDevice(server, 'A', { pageSize: 5 })
    const client = aClient(a)
    const projects = Array.from({ length: 6 }, (_, n) => aProject(a, client.id, { name: `Project ${n}` }))
    for (const project of projects) {
      anItem(a, project.id, 'Logo', 1)
      anItem(a, project.id, 'Type', 2)
      createNote(a.db, { id: id(), projectId: project.id, clientId: null, body: `About ${project.name}`, pinned: false })
      createTimeEntry(a.db, {
        id: id(),
        projectId: project.id,
        checklistItemId: null,
        note: '',
        startedAt: clock.tick(),
        endedAt: clock.tick(60),
        source: 'manual'
      })
    }
    updateSettings(a.db, { person: 'Alex', businessName: 'Marchetti Design' })
    await a.sync()
    expect(a.requests()).toBeGreaterThan(1)

    const b = await createDevice(server, 'B', { pageSize: 5 })
    await b.sync()
    expect(b.requests()).toBeGreaterThan(3)
    expectSameLedger(a, b)
    expect(cursor(b.db)).toBe(cursor(a.db))
  })

  it('a device away for many changes on both sides comes back to the same ledger', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    const project = aProject(a, client.id)
    await a.sync()
    await b.sync()

    /* B goes away. A keeps working: new projects, edits, a delete. */
    const made: string[] = []
    for (let n = 0; n < 12; n += 1) {
      clock.tick()
      made.push(aProject(a, client.id, { name: `While B was away ${n}` }).id)
      if (n % 3 === 0) updateProject(a.db, project.id, { description: `revision ${n}` })
    }
    clock.tick()
    updateClient(a.db, client.id, { notes: 'a note from A' })
    await a.sync()

    /* Meanwhile B, offline, did its own work — including an edit to the same project, later than A's. */
    for (let n = 0; n < 7; n += 1) {
      clock.tick()
      anItem(b, project.id, `Offline item ${n}`, n + 1)
    }
    clock.tick()
    updateProject(b.db, project.id, { description: 'from B, last' })

    /* B comes back: pushes its backlog, pulls A's, both in pages. */
    await b.sync()
    await a.sync()

    expectSameLedger(a, b)
    expect(getProject(a.db, project.id)?.description).toBe('from B, last')
    expect(listChecklistItems(a.db, project.id)).toHaveLength(7)
    expect(made.every((projectId) => getProject(b.db, projectId) !== null)).toBe(true)
    expect(b.engine.conflicts()).toEqual([])
    expect(a.engine.conflicts()).toEqual([])
  })

  it('a child pulled a page before its parent lands, and the parent follows', async () => {
    const a = await createDevice(server, 'A')
    /* Nine clients and a project, then the project's client is edited so it
       has the highest sequence: with a page size of 5 the project arrives
       on the first page, its client only on the last. */
    const clients = Array.from({ length: 9 }, (_, n) => aClient(a, { name: `Client ${n}` }))
    const owner = clients[0]!
    const project = aProject(a, owner.id)
    await a.sync()
    clock.tick()
    updateClient(a.db, owner.id, { name: 'Renamed after the project' })
    await a.sync()

    const b = await createDevice(server, 'B', { pageSize: 5 })
    await b.sync()
    expectSameLedger(a, b)
    expect(getProject(b.db, project.id)?.clientId).toBe(owner.id)
    expect(getClient(b.db, owner.id)?.name).toBe('Renamed after the project')
    /* Foreign keys are enforced again once the pull is done. */
    expect(b.db.pragma('foreign_keys', { simple: true })).toBe(1)
  })
})

/* ---- 5. A crash in the middle of a sync -------------------------------------- */

describe('5. a mid-sync crash', () => {
  it('after the server committed the push but before the device applied the answer: nothing is lost, and recovery converges', async () => {
    const { a, b } = await twoDevicesInStep()
    const client = aClient(a)
    const project = aProject(a, client.id)

    /* The power goes the moment the answer arrives. */
    let crashed = false
    const crashing = a.restart({
      hooks: {
        beforeApply: () => {
          crashed = true
          throw new Error('power cut')
        }
      }
    })
    const failed = await crashing.syncExpectingFailure()
    expect(crashed).toBe(true)
    expect(failed.pending).toEqual({ clients: 1, projects: 1 })
    expect(cursor(a.db)).toBe(0)
    /* The server has the rows; the device does not know it. */
    expect(await serverRows(server, 'projects')).toHaveLength(1)

    /* Relaunch. The re-push is a no-op at the server; the echo settles it. */
    const relaunched = a.restart()
    const recovered = await relaunched.sync()
    expect(recovered.state).toBe('saved')
    expect(cursor(a.db)).toBeGreaterThan(0)

    await b.sync()
    expectSameLedger(relaunched, b)
    expect(getProject(b.db, project.id)?.name).toBe('Brand refresh')
    /* One copy of everything on the server: the crash made no duplicates. */
    expect(await serverRows(server, 'clients')).toHaveLength(1)
  })

  it('inside the apply transaction, halfway through a paged hydration: the page rolls back, the cursor holds, and the rest arrives on relaunch', async () => {
    const a = await createDevice(server, 'A')
    const client = aClient(a)
    for (let n = 0; n < 12; n += 1) aProject(a, client.id, { name: `Project ${n}` })
    await a.sync()

    let pages = 0
    const crashingB = await createDevice(server, 'B', {
      pageSize: 5,
      hooks: {
        beforeCommit: () => {
          pages += 1
          if (pages === 2) throw new Error('power cut')
        }
      }
    })
    const failed = await crashingB.syncExpectingFailure()
    expect(failed.failure).toBe('server')
    const cursorAfterCrash = cursor(crashingB.db)
    /* Exactly the first page is in: the second rolled back with its cursor. */
    expect(cursorAfterCrash).toBeGreaterThan(0)
    const held = ledgerOf(crashingB.db)
    expect(held['projects']!.length + held['clients']!.length).toBeLessThan(13)

    const relaunched = crashingB.restart()
    const recovered = await relaunched.sync()
    expect(recovered.state).toBe('saved')
    expect(cursor(relaunched.db)).toBeGreaterThan(cursorAfterCrash)
    expectSameLedger(a, relaunched)
  })

  it('a clean run and a crashed-then-recovered run end in the same place', async () => {
    const a = await createDevice(server, 'A')
    const client = aClient(a)
    aProject(a, client.id)
    await a.sync()

    const clean = await createDevice(server, 'clean')
    await clean.sync()

    let first = true
    const crashy = await createDevice(server, 'crashy', {
      hooks: {
        beforeCommit: () => {
          if (first) {
            first = false
            throw new Error('power cut')
          }
        }
      }
    })
    await crashy.syncExpectingFailure()
    const recovered = crashy.restart()
    await recovered.sync()

    expect(ledgerOf(recovered.db)).toEqual(ledgerOf(clean.db))
    expect(cursor(recovered.db)).toBe(cursor(clean.db))
  })
})
