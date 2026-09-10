import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from '../db'
import { accountUserId, cursor, deviceId, lastSyncedAt, readMeta, setAccountUserId, setCursor, setLastSyncedAt, writeMeta } from './meta'

let db: Database
beforeEach(() => {
  db = openMemoryDatabase()
})

describe('sync meta', () => {
  it('round-trips a value and answers null for one never written', () => {
    expect(readMeta(db, 'anything')).toBeNull()
    writeMeta(db, 'anything', 'once')
    writeMeta(db, 'anything', 'twice')
    expect(readMeta(db, 'anything')).toBe('twice')
  })

  it('mints a device id once and keeps it', () => {
    const first = deviceId(db)
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(deviceId(db)).toBe(first)
    expect(deviceId(openMemoryDatabase())).not.toBe(first)
  })

  it('starts the cursor at zero, which pulls the whole history', () => {
    expect(cursor(db)).toBe(0)
    setCursor(db, 42)
    expect(cursor(db)).toBe(42)
  })

  it('remembers when a sync last worked and whose account this is', () => {
    expect(lastSyncedAt(db)).toBeNull()
    setLastSyncedAt(db, '2026-09-10T09:00:00.000Z')
    expect(lastSyncedAt(db)).toBe('2026-09-10T09:00:00.000Z')

    expect(accountUserId(db)).toBeNull()
    setAccountUserId(db, '00000000-0000-4000-8000-000000000001')
    expect(accountUserId(db)).toBe('00000000-0000-4000-8000-000000000001')
  })
})
