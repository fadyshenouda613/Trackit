import { describe, expect, it } from 'vitest'
import { openMemoryDatabase } from '../db'
import { getSettings, listClients, listProjects, updateSettings } from '../repositories'
import { seedDatabase } from './seed'
import { wipeDatabase } from './wipe'

describe('wipeDatabase', () => {
  it('leaves the schema and an empty, default settings row', () => {
    const db = openMemoryDatabase()
    seedDatabase(db)
    updateSettings(db, { person: 'Someone' })
    wipeDatabase(db)
    expect(listClients(db)).toEqual([])
    expect(listProjects(db)).toEqual([])
    expect(getSettings(db).person).toBe('')
    expect(getSettings(db).numberingScheme).toBe('INV-0000')
    // Seeding again works: the tables are there and empty.
    expect(seedDatabase(db)['clients']).toBeGreaterThan(0)
  })
})
