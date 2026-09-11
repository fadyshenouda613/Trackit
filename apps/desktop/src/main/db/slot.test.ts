import { describe, expect, it } from 'vitest'
import { listClients } from '../repositories/clients'
import { aClient } from '../repositories/test-support'
import { openMemoryDatabase } from './index'
import { createDatabaseSlot } from './slot'

describe('createDatabaseSlot', () => {
  it('forwards to the connection it holds', () => {
    const first = openMemoryDatabase()
    const slot = createDatabaseSlot(first)
    const client = aClient(slot.db)
    expect(listClients(first).map((row) => row.id)).toEqual([client.id])
    expect(slot.db.name).toBe(first.name)
    expect(slot.db.open).toBe(true)
  })

  it('forwards to the next connection after a replace, and hands back the old one', () => {
    const first = openMemoryDatabase()
    const second = openMemoryDatabase()
    const slot = createDatabaseSlot(first)
    aClient(slot.db)

    expect(slot.replace(second)).toBe(first)
    expect(slot.current()).toBe(second)
    expect(listClients(slot.db)).toHaveLength(0)

    const client = aClient(slot.db)
    expect(listClients(second).map((row) => row.id)).toEqual([client.id])
    expect(listClients(first)).toHaveLength(1)
  })

  it('runs a transaction on the connection current at the time', () => {
    const first = openMemoryDatabase()
    const second = openMemoryDatabase()
    const slot = createDatabaseSlot(first)
    slot.replace(second)
    slot.db.transaction(() => {
      aClient(slot.db)
    })()
    expect(listClients(second)).toHaveLength(1)
    expect(listClients(first)).toHaveLength(0)
  })
})
