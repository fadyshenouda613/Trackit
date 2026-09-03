import { describe, expect, it } from 'vitest'
import { openMemoryDatabase } from '../db'
import {
  getSettings,
  listBillableProjects,
  listChecklistItems,
  listClients,
  listInvoices,
  listProjects,
  listTimeEntries
} from '../repositories'
import { expectedInvoiceStatuses, projects as projectFixtures } from './fixtures'
import { seedDatabase, uuidFor } from './seed'

describe('seedDatabase', () => {
  const db = openMemoryDatabase()
  const summary = seedDatabase(db)

  it('loads every fixture through its schema', () => {
    expect(summary).toMatchObject({ clients: 8, projects: 21, invoices: 16, notes: 4 })
    expect(listClients(db).map((client) => client.company)[1]).toBe('Northwind Studio')
  })

  it('gives every fixture the same id each time', () => {
    expect(uuidFor('client:northwind')).toBe(uuidFor('client:northwind'))
    expect(uuidFor('client:northwind')).not.toBe(uuidFor('client:sable'))
    expect(uuidFor('anything')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('arrives at the statuses the register shows', () => {
    const byNumber = new Map(listInvoices(db).map((invoice) => [invoice.number, invoice]))
    for (const [number, status] of Object.entries(expectedInvoiceStatuses)) {
      expect(byNumber.get(number)?.status, number).toBe(status)
    }
    expect(byNumber.get('INV-0104')?.totalCents).toBe(720000)
    expect(byNumber.get('INV-0137')?.replacedByInvoiceId).toBe(byNumber.get('INV-0138')?.id)
  })

  it('leaves Northwind two delivered projects to bill, as the Create invoice screen shows', () => {
    const northwind = listClients(db).find((client) => client.company === 'Northwind Studio')
    expect(northwind).toBeDefined()
    expect(listBillableProjects(db, northwind?.id ?? '').map((project) => project.name)).toEqual([
      'Trade show panels',
      'Signage artwork'
    ])
  })

  it('adds up each project’s sessions to the hours the table shows', () => {
    for (const fixture of projectFixtures) {
      const logged = listTimeEntries(db, { projectId: uuidFor(`project:${fixture.key}`) }).reduce(
        (sum, entry) => sum + (Date.parse(entry.endedAt ?? entry.startedAt) - Date.parse(entry.startedAt)) / 60_000,
        0
      )
      expect(logged, fixture.name).toBe(fixture.loggedMinutes)
    }
  })

  it('keeps the two seeded weeks exactly as the Time screen draws them', () => {
    const lastWeek = listTimeEntries(db, { from: '2026-08-17T00:00:00.000Z', to: '2026-08-24T00:00:00.000Z' })
    expect(lastWeek.map((entry) => entry.note)).toEqual([
      'Sprint planning',
      'Master pages',
      'Stakeholder review',
      'Auth screens',
      'Welcome sequence',
      'Moodboard round two',
      'Print spec call',
      'Responsive pass',
      'Data table spec'
    ])
    const thisWeek = listTimeEntries(db, { from: '2026-08-24T00:00:00.000Z', to: '2026-08-31T00:00:00.000Z' })
    expect(thisWeek).toHaveLength(11)
    expect(thisWeek.every((entry) => entry.note !== 'Working session')).toBe(true)
  })

  it('leaves the week before them to the two projects that kicked off inside it', () => {
    const weekBefore = listTimeEntries(db, { from: '2026-08-10T00:00:00.000Z', to: '2026-08-17T00:00:00.000Z' })
    const owners = new Set(weekBefore.map((entry) => entry.projectId))
    expect([...owners].sort()).toEqual(
      [uuidFor('project:brand-refresh'), uuidFor('project:report-design')].sort()
    )
  })

  it('flags the four Brand refresh items that were added later', () => {
    const brandRefresh = listProjects(db, { search: 'Brand refresh' })[0]
    const items = listChecklistItems(db, brandRefresh?.id ?? '')
    expect(items).toHaveLength(14)
    expect(items.filter((item) => item.addedAfterKickoff).map((item) => item.label)).toEqual([
      'Secondary marks for social',
      'Social avatar set — six platforms',
      'Email signature template',
      'Handover call and file package'
    ])
    expect(items.filter((item) => item.done)).toHaveLength(8)
  })

  it('writes the business profile into settings', () => {
    expect(getSettings(db)).toMatchObject({
      businessName: 'Trackit Studio',
      taxRate: 8.5,
      rateFloorCents: 10000,
      numberingScheme: 'INV-0000'
    })
  })
})
