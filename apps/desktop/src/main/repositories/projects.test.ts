import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from '../db'
import { RepositoryError } from './errors'
import { createProject, getProject, listProjects, transitionProject, updateProject } from './projects'
import { aClient, aProject, id } from './test-support'

let db: Database

beforeEach(() => {
  db = openMemoryDatabase()
})

const refusedAs = (code: string) => expect.objectContaining({ code })

describe('the status graph', () => {
  it('moves draft → active and stamps the kickoff', () => {
    const client = aClient(db)
    const draft = aProject(db, client)
    expect(draft.kickoffAt).toBeNull()

    const active = transitionProject(db, draft.id, 'active')
    expect(active.status).toBe('active')
    expect(active.kickoffAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
  })

  it('keeps a kickoff date already agreed', () => {
    const client = aClient(db)
    const draft = aProject(db, client, 'draft', { kickoffAt: '2026-08-12T09:00:00.000Z' })
    expect(transitionProject(db, draft.id, 'active').kickoffAt).toBe('2026-08-12T09:00:00.000Z')
  })

  it('moves active → delivered and stamps the delivery', () => {
    const client = aClient(db)
    const active = aProject(db, client, 'active')
    const delivered = transitionProject(db, active.id, 'delivered')
    expect(delivered.status).toBe('delivered')
    expect(delivered.deliveredAt).toMatch(/Z$/)
  })

  it('refuses every other forward edge', () => {
    const client = aClient(db)
    const draft = aProject(db, client)
    expect(() => transitionProject(db, draft.id, 'delivered')).toThrow(refusedAs('invalid_transition'))

    const active = aProject(db, client, 'active')
    expect(() => transitionProject(db, active.id, 'active')).toThrow(refusedAs('invalid_transition'))

    const delivered = aProject(db, client, 'delivered')
    expect(() => transitionProject(db, delivered.id, 'active')).toThrow(refusedAs('invalid_transition'))
    expect(() => transitionProject(db, delivered.id, 'delivered')).toThrow(refusedAs('invalid_transition'))
  })

  it('moves anything → cancelled, once', () => {
    const client = aClient(db)
    for (const status of ['draft', 'active', 'delivered'] as const) {
      const project = aProject(db, client, status)
      expect(transitionProject(db, project.id, 'cancelled').status).toBe('cancelled')
      expect(() => transitionProject(db, project.id, 'cancelled')).toThrow(refusedAs('invalid_transition'))
      expect(() => transitionProject(db, project.id, 'active')).toThrow(refusedAs('invalid_transition'))
    }
  })

  it('never lets invoiced or paid be set directly', () => {
    const client = aClient(db)
    const base = {
      id: id(),
      clientId: client.id,
      name: 'Menu system',
      description: '',
      priceCents: 275000,
      currency: 'USD' as const,
      budgetedHours: 25,
      kickoffAt: null,
      dueAt: null,
      deliveredAt: null
    }
    expect(() => createProject(db, { ...base, status: 'invoiced' })).toThrow(refusedAs('invalid_state'))
    expect(() => createProject(db, { ...base, status: 'paid' })).toThrow(refusedAs('invalid_state'))

    const delivered = aProject(db, client, 'delivered')
    expect(() => updateProject(db, delivered.id, { status: 'invoiced' })).toThrow(refusedAs('invalid_state'))
    expect(() => updateProject(db, delivered.id, { status: 'paid' })).toThrow(RepositoryError)
    expect(getProject(db, delivered.id)?.status).toBe('delivered')
  })

  it('is not in the transition schema either', () => {
    const client = aClient(db)
    const delivered = aProject(db, client, 'delivered')
    // The type forbids it; a caller that gets past the type is refused too.
    const to = 'invoiced' as unknown as 'active'
    expect(() => transitionProject(db, delivered.id, to)).toThrow()
    expect(getProject(db, delivered.id)?.status).toBe('delivered')
  })
})

describe('writes', () => {
  it('stamp updatedAt and mark the row pending', () => {
    const client = aClient(db)
    const created = aProject(db, client)
    expect(created.syncState).toBe('pending')
    expect(created.updatedAt).toBe(created.createdAt)

    db.prepare("UPDATE projects SET sync_state = 'synced', updated_at = '2020-01-01T00:00:00.000Z'").run()

    const updated = updateProject(db, created.id, { name: 'Brand refresh, phase 2' })
    expect(updated.name).toBe('Brand refresh, phase 2')
    expect(updated.syncState).toBe('pending')
    expect(updated.updatedAt > '2020-01-01T00:00:00.000Z').toBe(true)
    expect(updated.createdAt).toBe(created.createdAt)
  })

  it('filter and sort the list the way the toolbar asks', () => {
    const northwind = aClient(db)
    const sable = aClient(db, { name: 'Tom Sable', company: 'Sable Studio' })
    const cheap = aProject(db, northwind, 'active', { name: 'Report design', priceCents: 45000 })
    const dear = aProject(db, sable, 'active', { name: 'Site build', priceCents: 900000 })
    const draft = aProject(db, northwind, 'draft', { name: 'Rebrand phase 2', priceCents: 750000 })

    expect(listProjects(db, { sort: 'price' }).map((project) => project.id)).toEqual([dear.id, draft.id, cheap.id])
    expect(listProjects(db, { status: 'active', sort: 'client' }).map((project) => project.name)).toEqual([
      'Report design',
      'Site build'
    ])
    expect(listProjects(db, { clientId: sable.id }).map((project) => project.id)).toEqual([dear.id])
    expect(listProjects(db, { search: 'rebrand' }).map((project) => project.id)).toEqual([draft.id])
    expect(listProjects(db, { status: ['draft', 'active'] })).toHaveLength(3)
  })
})
