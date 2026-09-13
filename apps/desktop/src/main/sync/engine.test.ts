import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthStatus, SyncRequest, SyncResponse, SyncStatus } from '@trackit/shared/schemas'
import { AuthClientError } from '../auth/client'
import { openMemoryDatabase, type Database } from '../db'
import { getClient, updateClient } from '../repositories/clients'
import { createInvoice, deleteInvoice, getInvoice, listInvoices } from '../repositories/invoices'
import { updateSettings } from '../repositories/settings'
import { aClient, aProject, id } from '../repositories/test-support'
import { SyncClientError } from './client'
import { createSyncEngine, type SyncEngine, type SyncEngineDeps } from './engine'
import { accountUserId, cursor, deviceId, lastSyncedAt } from './meta'

/*
 * The engine against a scripted transport. What goes over the wire and
 * what the server does with it are the two-device suite's business
 * (tests/sync); this is about what the engine does around one exchange.
 */

let db: Database
const USER = '00000000-0000-4000-8000-00000000000a'
const NOW = '2026-09-10T12:00:00.000Z'

const signedIn: AuthStatus = {
  state: 'signedIn',
  user: { id: USER, email: 'alex@trackit.studio', name: 'Alex', createdAt: NOW },
  session: 'active'
}

type Script = (request: SyncRequest) => SyncResponse | Promise<SyncResponse>

type Mint = (invoiceId: string, scheme: string) => string

/**
 * A transport that answers each call from a list of scripts, in order, and
 * remembers what it saw. `mint` is what the server says to a draft asking
 * for its number; by default nothing asks.
 */
function scripted(...scripts: Script[]) {
  const calls: SyncRequest[] = []
  const mints: { invoiceId: string; scheme: string }[] = []
  let index = 0
  let mint: Mint = () => {
    throw new Error('no mint script')
  }
  return {
    calls,
    mints,
    minting: (script: Mint) => {
      mint = script
    },
    push: async (_token: string, request: SyncRequest): Promise<SyncResponse> => {
      calls.push(request)
      const script = scripts[Math.min(index, scripts.length - 1)]
      index += 1
      if (!script) throw new Error('no script')
      return script(request)
    },
    mintNumber: async (_token: string, invoiceId: string, scheme: string) => {
      mints.push({ invoiceId, scheme })
      return { invoiceId, number: mint(invoiceId, scheme) }
    }
  }
}

/** The response of a server that keeps everything and has nothing new. */
const acceptAll =
  (cursorAfter: number): Script =>
  (request) => ({ cursor: cursorAfter, hasMore: false, changes: echo(request), rejected: [] })

/** What the server sends back for what it just kept: the same rows, written by us. */
const echo = (request: SyncRequest): SyncResponse['changes'] =>
  Object.fromEntries(
    Object.entries(request.changes).map(([table, rows]) => [
      table,
      (rows as Record<string, unknown>[]).map((row) => ({ ...row, updatedBy: request.deviceId }))
    ])
  ) as SyncResponse['changes']

const statuses: SyncStatus[] = []

function engineWith(overrides: Partial<SyncEngineDeps> & { transport: SyncEngineDeps['transport'] }): SyncEngine {
  statuses.length = 0
  return createSyncEngine({
    db,
    auth: {
      status: () => signedIn,
      accessToken: async () => 'token',
      verify: async () => undefined
    },
    onChanged: (status) => statuses.push(status),
    now: () => NOW,
    ...overrides
  })
}

beforeEach(() => {
  db = openMemoryDatabase()
  db.prepare("UPDATE settings SET sync_state = 'synced'").run()
})

const syncStateOf = (table: string, rowId: string): string =>
  (db.prepare(`SELECT sync_state FROM ${table} WHERE id = ?`).get(rowId) as { sync_state: string }).sync_state

describe('one run', () => {
  it('pushes what is pending, marks it synced, stores the cursor, and is saved', async () => {
    const client = aClient(db)
    const transport = scripted(acceptAll(7))
    const engine = engineWith({ transport })

    expect(engine.status()).toMatchObject({ state: 'pending', pending: { clients: 1 }, lastSyncedAt: null })

    const status = await engine.sync()
    expect(transport.calls).toHaveLength(1)
    expect(transport.calls[0]).toMatchObject({ protocolVersion: 1, since: 0, deviceId: deviceId(db) })
    expect(transport.calls[0]?.changes.clients?.[0]?.id).toBe(client.id)

    expect(syncStateOf('clients', client.id)).toBe('synced')
    expect(cursor(db)).toBe(7)
    expect(lastSyncedAt(db)).toBe(NOW)
    expect(status).toMatchObject({ state: 'saved', pending: {}, lastSyncedAt: NOW })
    expect(status.log[0]).toMatchObject({ kind: 'synced', detail: '1 change uploaded' })
    /* syncing was announced on the way. */
    expect(statuses.map((entry) => entry.state)).toEqual(['syncing', 'saved'])
  })

  it('applies what came down and bumps the revision only when something changed', async () => {
    const other = openMemoryDatabase()
    const client = aClient(other)
    const transport = scripted(
      () => ({
        cursor: 3,
        hasMore: false,
        changes: { clients: [{ ...client, syncState: undefined, updatedBy: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }] },
        rejected: []
      }),
      acceptAll(3)
    )
    const engine = engineWith({ transport })
    const before = engine.status().revision

    const first = await engine.sync()
    expect(getClient(db, client.id)?.name).toBe(client.name)
    expect(first.revision).toBe(before + 1)
    expect(first.log[0]?.detail).toBe('1 change received')

    const second = await engine.sync()
    expect(second.revision).toBe(before + 1)
  })

  it('walks every page while the server has more, and every outbox chunk while there are more', async () => {
    aClient(db)
    aClient(db, { id: id() })
    aClient(db, { id: id() })
    const transport = scripted(
      (request) => ({ cursor: 1, hasMore: true, changes: echo(request), rejected: [] }),
      (request) => ({ cursor: 2, hasMore: true, changes: echo(request), rejected: [] }),
      (request) => ({ cursor: 3, hasMore: false, changes: echo(request), rejected: [] })
    )
    const engine = engineWith({ transport, pageSize: 2 })
    const status = await engine.sync()

    /* Two rows, then one, then an empty push for the page the server still had. */
    expect(transport.calls.map((call) => call.changes.clients?.length ?? 0)).toEqual([2, 1, 0])
    expect(transport.calls.map((call) => call.since)).toEqual([0, 1, 2])
    expect(status.state).toBe('saved')
    expect(cursor(db)).toBe(3)
  })

  it('keeps a row the server could not place pending, and drops one it will never take', async () => {
    const client = aClient(db)
    const project = aProject(db, client)
    const transport = scripted(() => ({
      cursor: 1,
      hasMore: false,
      changes: {},
      rejected: [
        { table: 'projects', id: project.id, reason: 'missing_parent' },
        { table: 'clients', id: client.id, reason: 'forbidden' }
      ]
    }))
    const status = await engineWith({ transport }).sync()
    expect(syncStateOf('projects', project.id)).toBe('pending')
    expect(syncStateOf('clients', client.id)).toBe('synced')
    expect(status.state).toBe('pending')
    expect(status.log.some((entry) => entry.kind === 'failed' && entry.detail.includes('1 change'))).toBe(true)
  })

  it('re-pushes a row the server could not place, and it settles once the parent is there', async () => {
    const client = aClient(db)
    const project = aProject(db, client)
    const transport = scripted(
      () => ({ cursor: 1, hasMore: false, changes: {}, rejected: [{ table: 'projects', id: project.id, reason: 'missing_parent' }] }),
      acceptAll(2)
    )
    const engine = engineWith({ transport })
    await engine.sync()
    const second = await engine.sync()
    /* The second push carries the project alone: the client was kept the first time. */
    expect(transport.calls[1]?.changes).toEqual({ projects: [expect.objectContaining({ id: project.id })] })
    expect(syncStateOf('projects', project.id)).toBe('synced')
    expect(second).toMatchObject({ state: 'saved', pending: {} })
  })

  it('sends an outbox exactly one page long in one request, with no empty page after it', async () => {
    aClient(db)
    aClient(db, { id: id() })
    const transport = scripted(acceptAll(2))
    const status = await engineWith({ transport, pageSize: 2 }).sync()
    expect(transport.calls).toHaveLength(1)
    expect(transport.calls[0]?.changes.clients).toHaveLength(2)
    expect(status.state).toBe('saved')
  })

  it('a run that moves nothing writes no log line, but still stamps the time and the cursor', async () => {
    const transport = scripted(acceptAll(11))
    const status = await engineWith({ transport }).sync()
    expect(transport.calls).toHaveLength(1)
    expect(status).toMatchObject({ state: 'saved', lastSyncedAt: NOW, log: [] })
    expect(cursor(db)).toBe(11)
  })
})

describe('the guard', () => {
  it('never runs two at once; a request during a run gets one more run after it', async () => {
    let inFlight = 0
    let mostAtOnce = 0
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const transport = scripted(async (request) => {
      inFlight += 1
      mostAtOnce = Math.max(mostAtOnce, inFlight)
      await gate
      inFlight -= 1
      return acceptAll(1)(request)
    })
    const engine = engineWith({ transport })

    const first = engine.sync()
    const second = engine.sync()
    const third = engine.sync()
    await Promise.resolve()
    release()
    await Promise.all([first, second, third])

    expect(mostAtOnce).toBe(1)
    expect(transport.calls).toHaveLength(2)
  })
})

describe('failures', () => {
  const failing = (error: unknown) =>
    scripted(() => {
      throw error
    })

  it('offline: nothing changes, the reason is offline, and the pending counts stay', async () => {
    const client = aClient(db)
    const status = await engineWith({ transport: failing(new SyncClientError('offline', 'no route')) }).sync()
    expect(status).toMatchObject({ state: 'failed', failure: 'offline', pending: { clients: 1 } })
    expect(syncStateOf('clients', client.id)).toBe('pending')
    expect(cursor(db)).toBe(0)
    expect(status.log[0]).toMatchObject({ kind: 'failed' })
  })

  it('a server error is server; a too-old protocol is tooOld', async () => {
    expect((await engineWith({ transport: failing(new SyncClientError('internal', '500')) }).sync()).failure).toBe('server')
    expect((await engineWith({ transport: failing(new SyncClientError('upgrade_required', '426')) }).sync()).failure).toBe(
      'tooOld'
    )
  })

  it('signed out: no session means no request at all', async () => {
    const transport = scripted(acceptAll(1))
    const status = await engineWith({
      transport,
      auth: { status: () => ({ state: 'signedOut' }), accessToken: async () => 'x', verify: async () => undefined }
    }).sync()
    expect(status.failure).toBe('signedOut')
    expect(transport.calls).toHaveLength(0)
    /* A standing condition, not an event. */
    expect(status.log).toEqual([])
  })

  it('an expired session is signedOut too', async () => {
    const status = await engineWith({
      transport: scripted(acceptAll(1)),
      auth: {
        status: () => ({ ...signedIn, session: 'expired' }),
        accessToken: async () => {
          throw new AuthClientError('unauthorized', 'expired')
        },
        verify: async () => undefined
      }
    }).sync()
    expect(status.failure).toBe('signedOut')
  })

  it('a 401 from the server is retried once after a refresh, then given up as signedOut', async () => {
    const verify = vi.fn(async () => undefined)
    const rejectedOnce = scripted(
      () => {
        throw new SyncClientError('unauthorized', 'stale token')
      },
      acceptAll(1)
    )
    const ok = await engineWith({
      transport: rejectedOnce,
      auth: { status: () => signedIn, accessToken: async () => 'token', verify }
    }).sync()
    expect(verify).toHaveBeenCalledTimes(1)
    expect(rejectedOnce.calls).toHaveLength(2)
    expect(ok.state).toBe('saved')

    const rejectedAlways = failing(new SyncClientError('unauthorized', 'stale token'))
    const bad = await engineWith({ transport: rejectedAlways }).sync()
    expect(bad.failure).toBe('signedOut')
    expect(rejectedAlways.calls).toHaveLength(2)
  })

  it('refuses to sync a database first synced under another account', async () => {
    aClient(db)
    const transport = scripted(acceptAll(1))
    await engineWith({ transport }).sync()

    const sam: AuthStatus = { ...signedIn, user: { ...signedIn.user, id: '00000000-0000-4000-8000-00000000000b' } }
    const status = await engineWith({
      transport,
      auth: { status: () => sam, accessToken: async () => 'token', verify: async () => undefined }
    }).sync()
    expect(status.failure).toBe('otherAccount')
    expect(transport.calls).toHaveLength(1)
  })

  it('binds the database to the account on the first run that commits, not on one that failed', async () => {
    aClient(db)
    const sam: AuthStatus = { ...signedIn, user: { ...signedIn.user, id: '00000000-0000-4000-8000-00000000000b' } }
    const asSam = { status: () => sam, accessToken: async () => 'token', verify: async () => undefined }

    /* Alex tries first and never reaches the server: the file stays unclaimed. */
    await engineWith({ transport: failing(new SyncClientError('offline', 'no route')) }).sync()
    expect(accountUserId(db)).toBeNull()

    /* A crash inside the apply transaction claims nothing either. */
    await engineWith({
      transport: scripted(acceptAll(1)),
      hooks: {
        beforeCommit: () => {
          throw new Error('power cut')
        }
      }
    }).sync()
    expect(accountUserId(db)).toBeNull()

    /* So Sam can sync it, and from then on it is Sam's. */
    const transport = scripted(acceptAll(1))
    expect((await engineWith({ transport, auth: asSam }).sync()).state).toBe('saved')
    expect(accountUserId(db)).toBe(sam.user.id)
    expect((await engineWith({ transport, auth: asSam }).sync()).state).toBe('saved')
    expect((await engineWith({ transport }).sync()).failure).toBe('otherAccount')
    expect(transport.calls).toHaveLength(2)
  })

  it('checks the account before a draft is numbered, so the other account’s server is never asked', async () => {
    const client = aClient(db)
    const bound = scripted(acceptAll(1))
    await engineWith({ transport: bound }).sync()

    const project = aProject(db, client, 'delivered')
    updateSettings(db, { numberingScheme: 'INV-0000' })
    const draft = createInvoice(db, {
      id: id(),
      clientId: client.id,
      taxRate: 0,
      notes: '',
      lines: [{ id: id(), projectId: project.id, milestoneId: null, sortOrder: 1 }]
    })
    expect(draft.numberProvisional).toBe(true)

    const sam: AuthStatus = { ...signedIn, user: { ...signedIn.user, id: '00000000-0000-4000-8000-00000000000b' } }
    const transport = scripted(acceptAll(2))
    transport.minting(() => 'INV-0099')
    const status = await engineWith({
      transport,
      auth: { status: () => sam, accessToken: async () => 'token', verify: async () => undefined }
    }).sync()
    expect(status.failure).toBe('otherAccount')
    expect(transport.mints).toEqual([])
    expect(transport.calls).toEqual([])
    expect(getInvoice(db, draft.id)).toMatchObject({ number: draft.number, numberProvisional: true })
  })
})

describe('interruption', () => {
  it('a crash after the server answered but before anything was applied loses nothing', async () => {
    const client = aClient(db)
    const transport = scripted(acceptAll(5))
    const crashing = engineWith({
      transport,
      hooks: {
        beforeApply: () => {
          throw new Error('power cut')
        }
      }
    })
    const status = await crashing.sync()
    expect(status.state).toBe('failed')
    expect(syncStateOf('clients', client.id)).toBe('pending')
    expect(cursor(db)).toBe(0)

    /* The next launch re-pushes; the server echoes; the row is synced. */
    const recovered = await engineWith({ transport }).sync()
    expect(recovered.state).toBe('saved')
    expect(syncStateOf('clients', client.id)).toBe('synced')
    expect(cursor(db)).toBe(5)
  })

  it('a crash inside the apply transaction rolls all of it back — rows, cursor, marks', async () => {
    const client = aClient(db)
    const other = openMemoryDatabase()
    const incoming = aClient(other, { id: id(), name: 'From elsewhere' })
    const transport = scripted((request) => ({
      cursor: 9,
      hasMore: false,
      changes: {
        clients: [
          ...(echo(request).clients ?? []),
          { ...incoming, syncState: undefined, updatedBy: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }
        ]
      },
      rejected: []
    }))
    const crashing = engineWith({
      transport,
      hooks: {
        beforeCommit: () => {
          throw new Error('power cut')
        }
      }
    })
    await crashing.sync()
    expect(syncStateOf('clients', client.id)).toBe('pending')
    expect(getClient(db, incoming.id)).toBeNull()
    expect(cursor(db)).toBe(0)
    /* Foreign keys are back on after the failed transaction. */
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)

    const recovered = await engineWith({ transport }).sync()
    expect(recovered.state).toBe('saved')
    expect(getClient(db, incoming.id)?.name).toBe('From elsewhere')
    expect(cursor(db)).toBe(9)
  })

  it('an edit made while the request was in flight stays pending and goes up next time', async () => {
    const client = aClient(db)
    const transport = scripted(async (request) => {
      updateClient(db, client.id, { name: 'Edited meanwhile' })
      return acceptAll(2)(request)
    }, acceptAll(3))
    const engine = engineWith({ transport })
    const first = await engine.sync()
    expect(first.state).toBe('pending')
    expect(syncStateOf('clients', client.id)).toBe('pending')

    const second = await engine.sync()
    expect(transport.calls[1]?.changes.clients?.[0]?.name).toBe('Edited meanwhile')
    expect(second.state).toBe('saved')
  })

  it('a conflict found in a page that rolled back is recorded once, by the run that commits', async () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'Mine' })
    const theirsAt = new Date(Date.parse(mine.updatedAt) + 60_000).toISOString()
    const transport = scripted(() => ({
      cursor: 4,
      hasMore: false,
      changes: {
        clients: [
          { ...mine, syncState: undefined, name: 'Theirs', updatedAt: theirsAt, updatedBy: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }
        ]
      },
      rejected: []
    }))
    const crashing = engineWith({
      transport,
      hooks: {
        beforeCommit: () => {
          throw new Error('power cut')
        }
      }
    })
    const failed = await crashing.sync()
    expect(failed.state).toBe('failed')
    /* Nothing of the page survived: not the row, not the notice, not the log line about it. */
    expect(crashing.conflicts()).toEqual([])
    expect(getClient(db, client.id)?.name).toBe('Mine')
    expect(failed.log.filter((entry) => entry.kind === 'conflict')).toEqual([])

    const recovered = engineWith({ transport })
    const status = await recovered.sync()
    expect(status.state).toBe('saved')
    expect(getClient(db, client.id)?.name).toBe('Theirs')
    expect(recovered.conflicts()).toHaveLength(1)
    expect(status.log.filter((entry) => entry.kind === 'conflict')).toHaveLength(1)
  })
})

describe('the schedule', () => {
  it('syncs on start and on the interval, and stops when told', async () => {
    vi.useFakeTimers()
    try {
      const transport = scripted(acceptAll(1))
      const engine = engineWith({ transport, intervalMs: 1000 })
      engine.start()
      await vi.advanceTimersByTimeAsync(0)
      expect(transport.calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(2500)
      expect(transport.calls).toHaveLength(3)
      engine.stop()
      await vi.advanceTimersByTimeAsync(5000)
      expect(transport.calls).toHaveLength(3)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('conflicts through the engine', () => {
  it('lists them, resolves them, and bumps the revision so screens refetch', async () => {
    const client = aClient(db)
    const mine = updateClient(db, client.id, { name: 'Mine' })
    const theirsAt = new Date(Date.parse(mine.updatedAt) + 60_000).toISOString()
    const transport = scripted(() => ({
      cursor: 4,
      hasMore: false,
      changes: {
        clients: [
          { ...mine, syncState: undefined, name: 'Theirs', updatedAt: theirsAt, updatedBy: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }
        ]
      },
      rejected: []
    }))
    const engine = engineWith({ transport })
    const status = await engine.sync()
    /* The push was superseded, so nothing counts as uploaded. */
    expect(status.log[0]).toMatchObject({ kind: 'synced', detail: '1 change received' })
    expect(status.log[1]).toMatchObject({ kind: 'conflict' })

    const [conflict] = engine.conflicts()
    expect(conflict).toMatchObject({ table: 'clients', label: 'Mine' })
    const revision = engine.status().revision
    engine.resolveConflict(conflict!.id, 'restoreMine')
    expect(engine.conflicts()).toEqual([])
    expect(engine.status().revision).toBe(revision + 1)
    expect(getClient(db, client.id)?.name).toBe('Mine')
    expect(engine.status().state).toBe('pending')
  })
})

describe('provisional numbers', () => {
  const draftFor = (): ReturnType<typeof createInvoice> => {
    const project = aProject(db, client!, 'delivered')
    return createInvoice(db, {
      id: id(),
      clientId: client!.id,
      taxRate: 0,
      notes: '',
      lines: [{ id: id(), projectId: project.id, milestoneId: null, sortOrder: 1 }]
    })
  }
  let client: ReturnType<typeof aClient> | null = null

  beforeEach(() => {
    client = aClient(db)
    updateSettings(db, { numberingScheme: 'INV-0000' })
  })

  it('takes the server number before the draft goes up, and says so', async () => {
    const draft = draftFor()
    expect(draft).toMatchObject({ number: 'INV-0001', numberProvisional: true })
    const transport = scripted(acceptAll(9))
    transport.minting(() => 'INV-0151')
    const engine = engineWith({ transport })

    const status = await engine.sync()
    expect(transport.mints).toEqual([{ invoiceId: draft.id, scheme: 'INV-0000' }])
    const pushed = transport.calls[0]?.changes.invoices?.[0]
    expect(pushed).toMatchObject({ id: draft.id, number: 'INV-0151', numberProvisional: false })
    expect(getInvoice(db, draft.id)).toMatchObject({ number: 'INV-0151', numberProvisional: false, syncState: 'synced' })
    expect(status.state).toBe('saved')
    expect(status.log.map((event) => event.detail)).toContain('Draft INV-0001 is now INV-0151')
    /* Nothing came down, but the draft on screen is now called something
       else: the revision moves so the renderer refetches. */
    expect(status.revision).toBe(1)
  })

  it('notes when the server confirmed the guess', async () => {
    draftFor()
    const transport = scripted(acceptAll(9))
    transport.minting(() => 'INV-0001')
    const status = await engineWith({ transport }).sync()
    expect(status.log.map((event) => event.detail)).toContain('Draft INV-0001 kept its number')
  })

  it('leaves a deleted draft alone and an issued number alone', async () => {
    const gone = draftFor()
    deleteInvoice(db, gone.id)
    const issued = createInvoice(
      db,
      { id: id(), clientId: client!.id, taxRate: 0, notes: '', lines: [{ id: id(), projectId: aProject(db, client!, 'delivered').id, milestoneId: null, sortOrder: 1 }] },
      { number: 'INV-0150', numberProvisional: false }
    )
    const transport = scripted(acceptAll(9))
    await engineWith({ transport }).sync()
    expect(transport.mints).toEqual([])
    expect(getInvoice(db, issued.id)?.number).toBe('INV-0150')
  })

  it('fails the run when the mint fails, and keeps the draft provisional for next time', async () => {
    const draft = draftFor()
    const transport = scripted(acceptAll(9))
    transport.minting(() => {
      throw new SyncClientError('internal', 'The server answered 500')
    })
    const status = await engineWith({ transport }).sync()
    expect(status).toMatchObject({ state: 'failed', failure: 'server' })
    expect(transport.calls).toHaveLength(0)
    expect(getInvoice(db, draft.id)).toMatchObject({ number: 'INV-0001', numberProvisional: true })
  })

  it('a draft numbered before a later mint fails keeps its number; the rest wait for next time', async () => {
    draftFor()
    draftFor()
    const transport = scripted(acceptAll(9))
    let asked = 0
    transport.minting(() => {
      asked += 1
      if (asked === 2) throw new SyncClientError('offline', 'lost the connection')
      return 'INV-0151'
    })
    const engine = engineWith({ transport })

    const failed = await engine.sync()
    expect(failed).toMatchObject({ state: 'failed', failure: 'offline' })
    expect(transport.mints).toHaveLength(2)
    expect(transport.calls).toHaveLength(0)
    const numbered = listInvoices(db).filter((invoice) => !invoice.numberProvisional)
    expect(numbered).toHaveLength(1)
    expect(numbered[0]).toMatchObject({ number: 'INV-0151', syncState: 'pending' })
    expect(failed.log.map((event) => event.detail)).toContain('Draft INV-0001 is now INV-0151')

    /* Next time only the remaining draft asks, and both go up. */
    transport.minting(() => 'INV-0152')
    const recovered = await engine.sync()
    expect(transport.mints).toHaveLength(3)
    expect(transport.mints[2]?.invoiceId).not.toBe(numbered[0]?.id)
    expect(recovered.state).toBe('saved')
    expect(listInvoices(db).map((invoice) => invoice.number).sort()).toEqual(['INV-0151', 'INV-0152'])
    expect(listInvoices(db).every((invoice) => !invoice.numberProvisional && invoice.syncState === 'synced')).toBe(true)
  })

  /*
   * BUG (engine.ts:214): `numbered` is only assigned when assignServerNumbers
   * returns, so when the second of two mints throws, the first draft's number
   * has already been swapped in the database (and logged) but the revision
   * does not move. The screen keeps showing the provisional number the row no
   * longer holds — exactly what the comment at engine.ts:249-252 says must
   * not happen.
   */
  it('a swap that landed before a later mint failed still moves the revision', async () => {
    draftFor()
    draftFor()
    const transport = scripted(acceptAll(9))
    let asked = 0
    transport.minting(() => {
      asked += 1
      if (asked === 2) throw new SyncClientError('offline', 'lost the connection')
      return 'INV-0151'
    })
    const failed = await engineWith({ transport }).sync()
    expect(listInvoices(db).filter((invoice) => !invoice.numberProvisional)).toHaveLength(1)
    expect(failed.revision).toBe(1)
  })

  it('retries the mint once after a refresh when the token was refused', async () => {
    const draft = draftFor()
    const transport = scripted(acceptAll(9))
    let refused = false
    transport.minting(() => {
      if (!refused) {
        refused = true
        throw new SyncClientError('unauthorized', 'stale')
      }
      return 'INV-0042'
    })
    const verify = vi.fn(async () => undefined)
    const status = await engineWith({
      transport,
      auth: { status: () => signedIn, accessToken: async () => 'token', verify }
    }).sync()
    expect(verify).toHaveBeenCalledTimes(1)
    expect(status.state).toBe('saved')
    expect(getInvoice(db, draft.id)?.number).toBe('INV-0042')
  })
})

describe('switching the file underneath', () => {
  it('idle resolves at once when nothing is running', async () => {
    const engine = engineWith({ transport: scripted(acceptAll(1)) })
    let settled = false
    void engine.idle().then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(true)
  })

  it('idle waits for the run in flight and the one queued behind it', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const transport = scripted(async (request) => {
      await gate
      return acceptAll(1)(request)
    })
    const engine = engineWith({ transport })

    const first = engine.sync()
    const second = engine.sync()
    let settled = false
    const idle = engine.idle().then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    release()
    await Promise.all([first, second, idle])
    expect(settled).toBe(true)
    expect(transport.calls).toHaveLength(2)
    /* Once idle, a sync is a fresh run, not one the switch was waiting on. */
    expect(engine.status().state).toBe('saved')
  })

  it('reset forgets the failure, bumps the revision so screens refetch, and says so', async () => {
    aClient(db)
    const engine = engineWith({
      transport: scripted(() => {
        throw new SyncClientError('offline', 'down')
      })
    })
    const failed = await engine.sync()
    expect(failed).toMatchObject({ state: 'failed', failure: 'offline' })

    statuses.length = 0
    engine.reset()
    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toMatchObject({ state: 'pending' })
    expect(statuses[0]?.failure).toBeUndefined()
    expect(statuses[0]?.revision).toBe(failed.revision + 1)
  })
})
