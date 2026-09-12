import { beforeEach, describe, expect, it } from 'vitest'
import type { AuthStatus, Client, Invoice } from '@trackit/shared/schemas'
import { openMemoryDatabase, type Database } from '../db'
import { createInvoice, getInvoice, listProvisionalInvoices } from '../repositories/invoices'
import { updateSettings } from '../repositories/settings'
import { aClient, aProject, id } from '../repositories/test-support'
import { SyncClientError, type SyncTransport } from './client'
import { listEvents } from './conflicts'
import { assignServerNumbers, numberForNewInvoice } from './numbers'

/*
 * Where a new draft's number comes from: the server when it can be asked,
 * the local scheme — flagged — when it cannot. The swap at sync time is
 * covered with the engine; its own rules are below it here.
 */

let db: Database
let client: Client
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
  client = aClient(db)
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

  it('falls back on any failure, not only a transport one', async () => {
    const transport = transportAnswering(async () => {
      throw new Error('something nobody planned for')
    })
    const numbering = await numberForNewInvoice(db, { transport, accessToken: async () => 'token', status: () => signedIn }, id())
    expect(numbering).toEqual({ number: 'INV-0002', numberProvisional: true })
  })
})

describe('assignServerNumbers', () => {
  const asIs = (call: (accessToken: string) => Promise<{ number: string }>): Promise<{ number: string }> => call('token')

  const provisionalDraft = (): Invoice => {
    const project = aProject(db, client, 'delivered')
    return createInvoice(db, {
      id: id(),
      clientId: client.id,
      taxRate: 0,
      notes: '',
      lines: [{ id: id(), projectId: project.id, milestoneId: null, sortOrder: 1 }]
    })
  }

  /* Two drafts can land in the same millisecond, and the swap walks them in creation order: make that order certain. */
  const raisedAfter = (earlier: Invoice, draft: Invoice): void => {
    db.prepare('UPDATE invoices SET created_at = ? WHERE id = ?').run(
      new Date(Date.parse(earlier.createdAt) + 1000).toISOString(),
      draft.id
    )
  }

  it('asks nothing when no draft is provisional', async () => {
    const transport = transportAnswering(async (_token, invoiceId) => ({ invoiceId, number: 'INV-0007' }))
    expect(await assignServerNumbers(db, asIs, transport, () => NOW)).toBe(0)
    expect(transport.asked).toEqual([])
    expect(listEvents(db, 10)).toEqual([])
  })

  it('numbers every provisional draft in the order they were raised, and logs each swap', async () => {
    const first = provisionalDraft()
    const second = provisionalDraft()
    raisedAfter(first, second)
    expect([first.number, second.number]).toEqual(['INV-0002', 'INV-0003'])
    let counter = 10
    const transport = transportAnswering(async (_token, invoiceId) => ({ invoiceId, number: `INV-00${counter++}` }))

    expect(await assignServerNumbers(db, asIs, transport, () => NOW)).toBe(2)
    expect(transport.asked).toEqual([first.id, second.id])
    expect(getInvoice(db, first.id)).toMatchObject({ number: 'INV-0010', numberProvisional: false })
    expect(getInvoice(db, second.id)).toMatchObject({ number: 'INV-0011', numberProvisional: false })
    expect(listProvisionalInvoices(db)).toEqual([])
    expect(listEvents(db, 10).map((event) => event.detail)).toEqual([
      'Draft INV-0003 is now INV-0011',
      'Draft INV-0002 is now INV-0010'
    ])
  })

  it('says when the server confirmed the guess, and still clears the flag', async () => {
    const draft = provisionalDraft()
    const transport = transportAnswering(async (_token, invoiceId) => ({ invoiceId, number: 'INV-0002' }))
    await assignServerNumbers(db, asIs, transport, () => NOW)
    expect(getInvoice(db, draft.id)).toMatchObject({ number: 'INV-0002', numberProvisional: false })
    expect(listEvents(db, 10).map((event) => event.detail)).toEqual(['Draft INV-0002 kept its number'])
  })

  it('stops at the first failure and keeps what was already numbered', async () => {
    const first = provisionalDraft()
    const second = provisionalDraft()
    raisedAfter(first, second)
    const transport = transportAnswering(async (_token, invoiceId) => {
      if (invoiceId === first.id) return { invoiceId, number: 'INV-0010' }
      throw new SyncClientError('internal', 'The server answered 500')
    })

    await expect(assignServerNumbers(db, asIs, transport, () => NOW)).rejects.toThrow('The server answered 500')
    expect(transport.asked).toEqual([first.id, second.id])
    expect(getInvoice(db, first.id)).toMatchObject({ number: 'INV-0010', numberProvisional: false })
    expect(getInvoice(db, second.id)).toMatchObject({ number: 'INV-0003', numberProvisional: true })
    expect(listProvisionalInvoices(db).map((draft) => draft.id)).toEqual([second.id])
    expect(listEvents(db, 10).map((event) => event.detail)).toEqual(['Draft INV-0002 is now INV-0010'])
  })
})
