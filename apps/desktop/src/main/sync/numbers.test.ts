import { beforeEach, describe, expect, it } from 'vitest'
import type { AuthStatus } from '@trackit/shared/schemas'
import { openMemoryDatabase, type Database } from '../db'
import { createInvoice } from '../repositories/invoices'
import { updateSettings } from '../repositories/settings'
import { aClient, aProject, id } from '../repositories/test-support'
import { SyncClientError, type SyncTransport } from './client'
import { numberForNewInvoice } from './numbers'

/*
 * Where a new draft's number comes from: the server when it can be asked,
 * the local scheme — flagged — when it cannot. The swap at sync time is
 * covered with the engine.
 */

let db: Database
const NOW = '2026-09-11T12:00:00.000Z'
const USER = '00000000-0000-4000-8000-00000000000a'

const signedIn: AuthStatus = {
  state: 'signedIn',
  user: { id: USER, email: 'alex@trackit.studio', name: 'Alex', createdAt: NOW },
  session: 'active'
}

const transportAnswering = (mint: SyncTransport['mintNumber']): SyncTransport & { asked: string[] } => {
  const asked: string[] = []
  return {
    asked,
    push: async () => {
      throw new Error('not pushed here')
    },
    mintNumber: async (token, invoiceId, scheme) => {
      asked.push(invoiceId)
      return mint(token, invoiceId, scheme)
    }
  }
}

beforeEach(() => {
  db = openMemoryDatabase()
  updateSettings(db, { numberingScheme: 'INV-0000' })
  const client = aClient(db)
  const project = aProject(db, client, 'delivered')
  /* One invoice already on file, so the local guess would be INV-0002. */
  createInvoice(
    db,
    { id: id(), clientId: client.id, taxRate: 0, notes: '', lines: [{ id: id(), projectId: project.id, milestoneId: null, sortOrder: 1 }] },
    { number: 'INV-0001', numberProvisional: false }
  )
})

describe('numberForNewInvoice', () => {
  it('takes the server number, under this machine’s scheme', async () => {
    const transport = transportAnswering(async (_token, invoiceId, scheme) => {
      expect(scheme).toBe('INV-0000')
      return { invoiceId, number: 'INV-0007' }
    })
    const invoiceId = id()
    const numbering = await numberForNewInvoice(
      db,
      { transport, accessToken: async () => 'token', status: () => signedIn },
      invoiceId
    )
    expect(numbering).toEqual({ number: 'INV-0007', numberProvisional: false })
    expect(transport.asked).toEqual([invoiceId])
  })

  it('falls back to the local guess, flagged, when the server cannot be reached', async () => {
    const transport = transportAnswering(async () => {
      throw new SyncClientError('offline', 'no route')
    })
    const numbering = await numberForNewInvoice(db, { transport, accessToken: async () => 'token', status: () => signedIn }, id())
    expect(numbering).toEqual({ number: 'INV-0002', numberProvisional: true })
  })

  it('does not ask at all when signed out or expired', async () => {
    const transport = transportAnswering(async (_t, invoiceId) => ({ invoiceId, number: 'INV-0007' }))
    const signedOut = await numberForNewInvoice(db, { transport, accessToken: async () => 'token', status: () => ({ state: 'signedOut' }) }, id())
    expect(signedOut).toEqual({ number: 'INV-0002', numberProvisional: true })
    const expired = await numberForNewInvoice(
      db,
      { transport, accessToken: async () => 'token', status: () => ({ ...signedIn, session: 'expired' }) },
      id()
    )
    expect(expired).toEqual({ number: 'INV-0002', numberProvisional: true })
    expect(transport.asked).toEqual([])
  })

  it('falls back when no token can be had', async () => {
    const transport = transportAnswering(async (_t, invoiceId) => ({ invoiceId, number: 'INV-0007' }))
    const numbering = await numberForNewInvoice(
      db,
      {
        transport,
        accessToken: async () => {
          throw new SyncClientError('offline', 'refresh failed')
        },
        status: () => signedIn
      },
      id()
    )
    expect(numbering).toEqual({ number: 'INV-0002', numberProvisional: true })
    expect(transport.asked).toEqual([])
  })
})
