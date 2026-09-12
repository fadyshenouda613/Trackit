import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import request from 'supertest'
import { expect, vi } from 'vitest'
import type { AuthStatus, SyncStatus } from '@trackit/shared/schemas'
import { appFor, openTestDb, testConfig, type TestDb } from '../../apps/server/src/test-support'
import { openMemoryDatabase, type Database } from '../../apps/desktop/src/main/db'
import { createSyncClient } from '../../apps/desktop/src/main/sync/client'
import { createSyncEngine, type SyncEngine, type SyncEngineDeps } from '../../apps/desktop/src/main/sync/engine'

/*
 * Two devices, one server.
 *
 * The server is the real Express app over the test Postgres, listening on
 * an ephemeral port, so the real transport talks to it over HTTP. A device
 * is an in-memory SQLite with the real sync engine on top of it and a
 * stand-in for the account service that always answers with that device's
 * own access token. Everything a scenario does to a device it does through
 * the same repository functions the app's IPC handlers call.
 */

export type TestServer = {
  baseUrl: string
  db: TestDb
  userId: string
  /** A fresh access token for a device: its own sign-in, its own family. */
  signIn: () => Promise<string>
  /** Empties the server's database; the account is made again. */
  reset: () => Promise<void>
  close: () => Promise<void>
}

const alex = { name: 'Alex Marchetti', email: 'alex@trackit.studio', password: 'correct horse battery' }

export async function startServer(options: { pageSize?: number } = {}): Promise<TestServer> {
  const config = testConfig(options.pageSize ? { syncPageSize: options.pageSize } : {})
  const db = await openTestDb(config)
  const app = appFor(config, db)
  const listening: Server = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
  const { port } = listening.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${port}`

  let userId = ''
  const register = async (): Promise<void> => {
    const response = await request(app).post('/auth/register').send(alex).expect(201)
    userId = response.body.user.id
  }
  await db.reset()
  await register()

  return {
    baseUrl,
    db,
    get userId() {
      return userId
    },
    signIn: async () => {
      const response = await request(app).post('/auth/login').send({ email: alex.email, password: alex.password }).expect(200)
      return response.body.tokens.accessToken as string
    },
    reset: async () => {
      await db.reset()
      await register()
    },
    close: async () => {
      await new Promise<void>((resolve, reject) => listening.close((error) => (error ? reject(error) : resolve())))
      await db.close()
    }
  }
}

export type Device = {
  name: string
  db: Database
  engine: SyncEngine
  /** One sync; throws if it did not end saved or pending, so a scenario cannot pass on a failed run. */
  sync: () => Promise<SyncStatus>
  /** A sync that is expected to fail, answering with the status. */
  syncExpectingFailure: () => Promise<SyncStatus>
  /** The same database under a fresh engine: what a relaunch after a crash is. */
  restart: (options?: DeviceOptions) => Device
  /** How many times this device's engine called the server. */
  requests: () => number
}

export type DeviceOptions = {
  pageSize?: number
  hooks?: SyncEngineDeps['hooks']
  /** The engine's clock, for conflict timestamps. */
  now?: () => string
}

export async function createDevice(server: TestServer, name: string, options: DeviceOptions = {}): Promise<Device> {
  const token = await server.signIn()
  const db = openMemoryDatabase()
  return deviceOn(server, name, db, token, options)
}

function deviceOn(server: TestServer, name: string, db: Database, token: string, options: DeviceOptions): Device {
  let requests = 0
  const transport = createSyncClient({
    baseUrl: server.baseUrl,
    fetch: (input, init) => {
      requests += 1
      return fetch(input, init)
    }
  })
  const status: AuthStatus = {
    state: 'signedIn',
    user: { id: server.userId, email: alex.email, name: alex.name, createdAt: '2026-09-10T00:00:00.000Z' },
    session: 'active'
  }
  const engine = createSyncEngine({
    db,
    transport,
    auth: { status: () => status, accessToken: async () => token, verify: async () => undefined },
    onChanged: () => undefined,
    ...(options.now ? { now: options.now } : {}),
    ...(options.pageSize ? { pageSize: options.pageSize } : {}),
    ...(options.hooks ? { hooks: options.hooks } : {})
  })

  return {
    name,
    db,
    engine,
    sync: async () => {
      const result = await engine.sync()
      if (result.state === 'failed') {
        throw new Error(`${name}: sync failed (${result.failure}): ${result.log[0]?.detail ?? ''}`)
      }
      return result
    },
    syncExpectingFailure: async () => {
      const result = await engine.sync()
      expect(result.state, `${name}: expected the sync to fail`).toBe('failed')
      return result
    },
    restart: (next = {}) => deviceOn(server, name, db, token, { ...options, ...next, hooks: next.hooks }),
    requests: () => requests
  }
}

/* ---- Comparing ledgers ---------------------------------------------------------- */

const TABLES = [
  'clients',
  'projects',
  'milestones',
  'checklist_items',
  'notes',
  'invoices',
  'invoice_lines',
  'time_entries',
  'payments'
] as const

type Ledger = Record<string, Record<string, unknown>[]>

/**
 * Every syncable row of a device, without the columns that are the
 * device's own: its sync state, and for settings its theme and account.
 */
export function ledgerOf(db: Database): Ledger {
  const ledger: Ledger = {}
  for (const table of TABLES) {
    ledger[table] = (db.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Record<string, unknown>[]).map(
      ({ sync_state: _, ...row }) => row
    )
  }
  const settings = db.prepare('SELECT * FROM settings').get() as Record<string, unknown>
  const { sync_state: _s, theme: _t, account_email: _a, ...rest } = settings
  ledger['settings'] = [rest]
  return ledger
}

/** Both devices hold the same ledger, row for row, and neither has anything left to upload. */
export function expectSameLedger(a: Device, b: Device): void {
  expect(ledgerOf(b.db), `${a.name} and ${b.name} disagree`).toEqual(ledgerOf(a.db))
  for (const device of [a, b]) {
    expect(device.engine.status().pending, `${device.name} still has pending rows`).toEqual({})
  }
}

/** The server's copy of one table for the account, in a shape comparable to a device's. */
export async function serverRows(server: TestServer, table: string): Promise<Record<string, unknown>[]> {
  const { sql } = await import('drizzle-orm')
  const result = await server.db.db.execute(
    sql`SELECT * FROM ${sql.identifier(table)} WHERE user_id = ${server.userId} ORDER BY id`
  )
  return result.rows as Record<string, unknown>[]
}

/** The invoice numbers the server has handed out for the account, in order. */
export async function serverNumbers(server: TestServer): Promise<string[]> {
  const { sql } = await import('drizzle-orm')
  const result = await server.db.db.execute(
    sql`SELECT number FROM invoice_numbers WHERE user_id = ${server.userId} ORDER BY number`
  )
  return (result.rows as { number: string }[]).map((row) => row.number)
}

/* ---- Time ----------------------------------------------------------------------- */

/**
 * The repositories stamp rows with the real clock. Two edits on two
 * devices within the same millisecond would tie, and a scenario about
 * which edit is newer must not depend on how fast the machine is — so a
 * scenario takes the clock and steps it explicitly between edits. Only
 * Date is faked: timers, sockets and the server keep running for real.
 */
export class Clock {
  private at: number

  constructor(start = '2026-09-10T09:00:00.000Z') {
    this.at = Date.parse(start)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(this.at)
  }

  /** Moves the clock forward. */
  tick(seconds = 1): string {
    this.at += seconds * 1000
    vi.setSystemTime(this.at)
    return this.now()
  }

  now(): string {
    return new Date(this.at).toISOString()
  }

  restore(): void {
    vi.useRealTimers()
  }
}
