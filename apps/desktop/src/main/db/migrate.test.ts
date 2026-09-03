import BetterSqlite3 from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { openMemoryDatabase } from './index'
import { appliedMigrations, checkMigrationNames, runMigrations } from './migrate'
import { migrations } from './migrations'

describe('runMigrations', () => {
  it('applies pending migrations in order, once, and records them', () => {
    const db = new BetterSqlite3(':memory:')
    const log: string[] = []
    const batch = [
      { name: '001_first', sql: 'CREATE TABLE first (id TEXT)' },
      { name: '002_second', sql: 'CREATE TABLE second (id TEXT)' }
    ]

    expect(runMigrations(db, batch, (message) => log.push(message))).toEqual(['001_first', '002_second'])
    expect(appliedMigrations(db)).toEqual(['001_first', '002_second'])
    expect(log).toEqual([
      'Applying migration 001_first',
      'Applying migration 002_second',
      'Applied 2 migrations'
    ])

    expect(runMigrations(db, batch)).toEqual([])
    expect(runMigrations(db, [...batch, { name: '003_third', sql: 'CREATE TABLE third (id TEXT)' }])).toEqual(['003_third'])
  })

  it('rolls the whole batch back when one migration fails', () => {
    const db = new BetterSqlite3(':memory:')
    const batch = [
      { name: '001_first', sql: 'CREATE TABLE first (id TEXT)' },
      { name: '002_broken', sql: 'CREATE TABLE (' }
    ]

    expect(() => runMigrations(db, batch)).toThrow()
    expect(appliedMigrations(db)).toEqual([])
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'first'").get()).toBeUndefined()
  })

  it('refuses unnumbered, duplicate or out-of-order names', () => {
    expect(() => checkMigrationNames(['initial'])).toThrow(/numbered/)
    expect(() => checkMigrationNames(['001_a', '001_b'])).toThrow(/number 001/)
    expect(() => checkMigrationNames(['002_a', '001_b'])).toThrow(/out of order/)
    expect(() => checkMigrationNames(['001_a', '002_b'])).not.toThrow()
  })
})

describe('the shipped migrations', () => {
  it('start at 001_initial and create every table with its foreign-key and updated_at indexes', () => {
    expect(migrations[0]?.name).toBe('001_initial')

    const db = openMemoryDatabase()
    const tables = db
      .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name)
    expect(tables).toEqual([
      'checklist_items',
      'clients',
      'invoice_lines',
      'invoices',
      'migrations',
      'milestones',
      'notes',
      'payments',
      'projects',
      'settings',
      'time_entries'
    ])

    const indexes = new Set(
      db
        .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all()
        .map((row) => row.name)
    )
    for (const table of tables) {
      if (table === 'migrations' || table === 'settings') continue
      expect(indexes.has(`${table}_updated_at`), `${table}_updated_at`).toBe(true)
      const foreignKeys = db.prepare<[], { from: string }>(`PRAGMA foreign_key_list(${table})`).all()
      for (const key of foreignKeys) {
        expect(indexes.has(`${table}_${key.from}`), `${table}_${key.from}`).toBe(true)
      }
    }

    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS count FROM settings').get()).toEqual({ count: 1 })
  })
})
