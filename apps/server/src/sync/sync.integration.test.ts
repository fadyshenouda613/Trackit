import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { SyncPushRow, SyncRequest, SyncResponse, SyncTableName } from '@trackit/shared/schemas'
import { runSync } from './service'
import { appFor, openTestDb, testConfig, type TestDb } from '../test-support'

/*
 * POST /sync against a real Postgres: the conflict rule, the one sequence,
 * paging, and what the route refuses. See test-support.ts for where the
 * database comes from. The two-device scenarios live in tests/sync at the
 * repository root.
 */

const config = testConfig()
let db: TestDb

beforeAll(async () => {
  db = await openTestDb(config)
})
afterAll(() => db.close())
beforeEach(() => db.reset())

const alex = { name: 'Alex Marchetti', email: 'alex@trackit.studio', password: 'correct horse battery' }
const sam = { name: 'Sam Okafor', email: 'sam@trackit.studio', password: 'another fine passphrase' }

async function signUp(app: ReturnType<typeof appFor>, person = alex): Promise<{ userId: string; token: string }> {
  const response = await request(app).post('/auth/register').send(person).expect(201)
  return { userId: response.body.user.id, token: response.body.tokens.accessToken }
}

/* ---- Rows ------------------------------------------------------------------ */

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const DEVICE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DEVICE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const T0 = '2026-09-10T09:00:00.000Z'
const T1 = '2026-09-10T09:01:00.000Z'
const T2 = '2026-09-10T09:02:00.000Z'

const aClient = (overrides: Partial<SyncPushRow<'clients'>> = {}): SyncPushRow<'clients'> => ({
  id: id(1),
  name: 'Studio Nord',
  company: '',
  email: '',
  phone: '',
  address: '',
  currency: 'EUR',
  paymentTermsDays: 14,
  notes: '',
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...overrides
})

const aProject = (overrides: Partial<SyncPushRow<'projects'>> = {}): SyncPushRow<'projects'> => ({
  id: id(2),
  clientId: id(1),
  name: 'Brand refresh',
  description: '',
  priceCents: 650000,
  currency: 'EUR',
  budgetedHours: 32,
  status: 'draft',
  kickoffAt: null,
  dueAt: null,
  deliveredAt: null,
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...overrides
})

const anItem = (overrides: Partial<SyncPushRow<'checklist_items'>> = {}): SyncPushRow<'checklist_items'> => ({
  id: id(3),
  projectId: id(2),
  label: 'Logo',
  done: false,
  addedAfterKickoff: false,
  sortOrder: 1,
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...overrides
})

const aMilestone = (overrides: Partial<SyncPushRow<'milestones'>> = {}): SyncPushRow<'milestones'> => ({
  id: id(4),
  projectId: id(2),
  name: 'Discovery',
  description: '',
  amountCents: null,
  dueAt: null,
  deliveredAt: null,
  sortOrder: 1,
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...overrides
})

const anInvoice = (overrides: Partial<SyncPushRow<'invoices'>> = {}): SyncPushRow<'invoices'> => ({
  id: id(5),
  clientId: id(1),
  number: 'INV-0001',
  numberProvisional: false,
  pdfGeneratedAt: null,
  status: 'draft',
  currency: 'EUR',
  issuedAt: null,
  dueAt: null,
  taxRate: 0,
  subtotalCents: 650000,
  taxCents: 0,
  totalCents: 650000,
  notes: '',
  voidedAt: null,
  voidReason: null,
  replacedByInvoiceId: null,
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...overrides
})

const aLine = (overrides: Partial<SyncPushRow<'invoice_lines'>> = {}): SyncPushRow<'invoice_lines'> => ({
  id: id(6),
  invoiceId: id(5),
  projectId: id(2),
  milestoneId: null,
  label: 'Brand refresh',
  amountCents: 650000,
  sortOrder: 1,
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...overrides
})

const aTimeEntry = (overrides: Partial<SyncPushRow<'time_entries'>> = {}): SyncPushRow<'time_entries'> => ({
  id: id(7),
  projectId: id(2),
  checklistItemId: null,
  note: '',
  startedAt: T0,
  endedAt: T1,
  source: 'manual',
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...overrides
})

const aPayment = (overrides: Partial<SyncPushRow<'payments'>> = {}): SyncPushRow<'payments'> => ({
  id: id(8),
  invoiceId: id(5),
  paidAt: T1,
  amountCents: 650000,
  method: 'bank_transfer',
  note: null,
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...overrides
})

const theSettings = (overrides: Partial<SyncPushRow<'settings'>> = {}): SyncPushRow<'settings'> => ({
  person: 'Alex',
  businessName: 'Marchetti Design',
  address: '',
  email: '',
  phone: '',
  logo: null,
  currency: 'EUR',
  taxRate: 20,
  paymentTermsDays: 14,
  numberingScheme: 'INV-0000',
  rateFloorCents: 8000,
  shortcut: 'CommandOrControl+Shift+S',
  updatedAt: T0,
  ...overrides
})

const req = (
  changes: SyncRequest['changes'],
  options: { since?: number; deviceId?: string } = {}
): SyncRequest => ({
  protocolVersion: 1,
  deviceId: options.deviceId ?? DEVICE_A,
  since: options.since ?? 0,
  changes
})

const sync = (userId: string, request: SyncRequest, pageSize = 500): Promise<SyncResponse> =>
  runSync(db.db, userId, request, { pageSize })

/** The rows of one table in a response, or none. */
const rowsOf = <T extends SyncTableName>(response: SyncResponse, table: T) =>
  response.changes[table] ?? []

/* ---- Tests ----------------------------------------------------------------- */

describe('the sequence', () => {
  it('is one sequence across every table, and every write takes a fresh value', async () => {
    const app = appFor(config, db)
    const { userId } = await signUp(app)

    const first = await sync(userId, req({ clients: [aClient()], projects: [aProject()] }))
    const clientSeq = await seqOf('clients', id(1))
    const projectSeq = await seqOf('projects', id(2))
    expect(projectSeq).toBe(clientSeq + 1)
    expect(first.cursor).toBe(projectSeq)

    /* An update moves the row to the end of the sequence. */
    await sync(userId, req({ clients: [aClient({ updatedAt: T1, name: 'Studio Nord AS' })] }, { since: first.cursor }))
    expect(await seqOf('clients', id(1))).toBe(projectSeq + 1)

    /* The per-table sequences are gone: the shared one is the only one left. */
    const sequences = await db.db.execute(
      sql`SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'`
    )
    expect(sequences.rows.map((row) => row.sequence_name)).toEqual(['sync_seq'])
  })
})

async function seqOf(table: string, rowId: string): Promise<number> {
  const result = await db.db.execute(sql`SELECT server_seq FROM ${sql.identifier(table)} WHERE id = ${rowId}`)
  return Number(result.rows[0]?.server_seq)
}

describe('runSync: pushing', () => {
  it('stores a new row and echoes it back with the device that wrote it', async () => {
    const { userId } = await signUp(appFor(config, db))
    const response = await sync(userId, req({ clients: [aClient()] }))

    expect(response.rejected).toEqual([])
    expect(response.hasMore).toBe(false)
    expect(rowsOf(response, 'clients')).toEqual([{ ...aClient(), updatedBy: DEVICE_A }])
    expect(response.cursor).toBeGreaterThan(0)
  })

  it('takes a strictly newer version and keeps an older one out', async () => {
    const { userId } = await signUp(appFor(config, db))
    const first = await sync(userId, req({ clients: [aClient()] }))

    const newer = await sync(
      userId,
      req({ clients: [aClient({ updatedAt: T1, name: 'Newer' })] }, { since: first.cursor, deviceId: DEVICE_B })
    )
    expect(rowsOf(newer, 'clients')).toEqual([{ ...aClient({ updatedAt: T1, name: 'Newer' }), updatedBy: DEVICE_B }])

    /* An older version arriving later loses, and the sender is told what won
       even though the winner's sequence is behind its cursor. */
    const older = await sync(
      userId,
      req({ clients: [aClient({ updatedAt: T0, name: 'Older' })] }, { since: newer.cursor, deviceId: DEVICE_A })
    )
    expect(older.rejected).toEqual([])
    expect(rowsOf(older, 'clients')).toEqual([{ ...aClient({ updatedAt: T1, name: 'Newer' }), updatedBy: DEVICE_B }])
    /* Nothing was written: the cursor did not move. */
    expect(older.cursor).toBe(newer.cursor)
  })

  it('breaks an equal updatedAt by device id, the same way from either side', async () => {
    const { userId } = await signUp(appFor(config, db))
    const fromA = aClient({ updatedAt: T1, name: 'A wrote this' })
    const fromB = aClient({ updatedAt: T1, name: 'B wrote this' })

    /* A first, then B: B's id is greater, so B wins. */
    const a1 = await sync(userId, req({ clients: [fromA] }, { deviceId: DEVICE_A }))
    const b1 = await sync(userId, req({ clients: [fromB] }, { since: a1.cursor, deviceId: DEVICE_B }))
    expect(rowsOf(b1, 'clients')[0]).toMatchObject({ name: 'B wrote this', updatedBy: DEVICE_B })

    /* B first, then A, on a fresh account: B still wins, and A is told so. */
    await db.reset()
    const { userId: other } = await signUp(appFor(config, db))
    const b2 = await sync(other, req({ clients: [fromB] }, { deviceId: DEVICE_B }))
    const a2 = await sync(other, req({ clients: [fromA] }, { since: b2.cursor, deviceId: DEVICE_A }))
    expect(rowsOf(a2, 'clients')[0]).toMatchObject({ name: 'B wrote this', updatedBy: DEVICE_B })
    expect(a2.cursor).toBe(b2.cursor)
  })

  it('does nothing when a device re-sends its own row', async () => {
    const { userId } = await signUp(appFor(config, db))
    const first = await sync(userId, req({ clients: [aClient()] }))
    const seq = await seqOf('clients', id(1))

    const again = await sync(userId, req({ clients: [aClient()] }, { since: 0 }))
    expect(await seqOf('clients', id(1))).toBe(seq)
    expect(again.cursor).toBe(first.cursor)
    expect(rowsOf(again, 'clients')).toHaveLength(1)
  })

  it('rejects a row whose parent it does not hold, and keeps the rest of the batch', async () => {
    const { userId } = await signUp(appFor(config, db))
    const orphan = aProject({ id: id(20), clientId: id(99) })
    const response = await sync(userId, req({ clients: [aClient()], projects: [aProject(), orphan] }))

    expect(response.rejected).toEqual([{ table: 'projects', id: id(20), reason: 'missing_parent' }])
    expect(rowsOf(response, 'projects').map((row) => row.id)).toEqual([id(2)])
  })

  it('finds a parent pushed earlier in the same request', async () => {
    const { userId } = await signUp(appFor(config, db))
    const response = await sync(userId, req({ clients: [aClient()], projects: [aProject()], checklist_items: [anItem()] }))
    expect(response.rejected).toEqual([])
    expect(rowsOf(response, 'checklist_items')).toHaveLength(1)
  })

  it('checks every parent field, self-references included, and finds each within the same request', async () => {
    const { userId } = await signUp(appFor(config, db))
    const response = await sync(
      userId,
      req({
        clients: [aClient()],
        projects: [aProject()],
        milestones: [aMilestone()],
        checklist_items: [anItem()],
        invoices: [
          anInvoice(),
          /* A void that names a replacement the server does not hold. */
          anInvoice({ id: id(50), status: 'void', issuedAt: T0, dueAt: T1, voidedAt: T1, voidReason: 'redone', replacedByInvoiceId: id(99) }),
          /* One that names the invoice pushed just before it. */
          anInvoice({ id: id(51), status: 'void', issuedAt: T0, dueAt: T1, voidedAt: T1, voidReason: 'redone', replacedByInvoiceId: id(5) })
        ],
        invoice_lines: [
          aLine({ milestoneId: id(4) }),
          aLine({ id: id(60), milestoneId: id(98) }),
          aLine({ id: id(61), projectId: id(97) })
        ],
        time_entries: [aTimeEntry({ checklistItemId: id(3) }), aTimeEntry({ id: id(70), checklistItemId: id(96) })],
        payments: [aPayment(), aPayment({ id: id(80), invoiceId: id(95) })]
      })
    )

    expect(response.rejected).toEqual([
      { table: 'invoices', id: id(50), reason: 'missing_parent' },
      { table: 'invoice_lines', id: id(60), reason: 'missing_parent' },
      { table: 'invoice_lines', id: id(61), reason: 'missing_parent' },
      { table: 'time_entries', id: id(70), reason: 'missing_parent' },
      { table: 'payments', id: id(80), reason: 'missing_parent' }
    ])
    expect(rowsOf(response, 'invoices').map((row) => row.id)).toEqual([id(5), id(51)])
    expect(rowsOf(response, 'invoice_lines').map((row) => row.id)).toEqual([id(6)])
    expect(rowsOf(response, 'time_entries').map((row) => row.id)).toEqual([id(7)])
    expect(rowsOf(response, 'payments').map((row) => row.id)).toEqual([id(8)])
    /* Parent tables first, whatever the request said. */
    expect(Object.keys(response.changes)).toEqual([
      'clients',
      'projects',
      'milestones',
      'checklist_items',
      'invoices',
      'invoice_lines',
      'time_entries',
      'payments'
    ])
  })

  it("treats another account's parent as missing", async () => {
    const app = appFor(config, db)
    const { userId: alexId } = await signUp(app, alex)
    const { userId: samId } = await signUp(app, sam)
    await sync(alexId, req({ clients: [aClient()] }))

    const response = await sync(samId, req({ projects: [aProject()] }))
    expect(response.rejected).toEqual([{ table: 'projects', id: id(2), reason: 'missing_parent' }])
  })

  it("refuses a row id that belongs to another account", async () => {
    const app = appFor(config, db)
    const { userId: alexId } = await signUp(app, alex)
    const { userId: samId } = await signUp(app, sam)
    await sync(alexId, req({ clients: [aClient()] }))

    const response = await sync(samId, req({ clients: [aClient({ updatedAt: T2, name: 'Taken over' })] }))
    expect(response.rejected).toEqual([{ table: 'clients', id: id(1), reason: 'forbidden' }])
    expect(rowsOf(response, 'clients')).toEqual([])

    const alexView = await sync(alexId, req({}))
    expect(rowsOf(alexView, 'clients')[0]).toMatchObject({ name: 'Studio Nord' })
  })

  it('rejects a row that does not parse as forbidden, without failing the batch', async () => {
    const { userId } = await signUp(appFor(config, db))
    const broken = { ...aClient({ id: id(30) }), currency: 'XXX' }
    const response = await sync(userId, req({ clients: [aClient(), broken as unknown as SyncPushRow<'clients'>] }))

    expect(response.rejected).toEqual([{ table: 'clients', id: id(30), reason: 'forbidden' }])
    expect(rowsOf(response, 'clients').map((row) => row.id)).toEqual([id(1)])
  })

  it('rejects what is not a row at all, or has no id to speak of, by the schema and never by the database', async () => {
    const { userId } = await signUp(appFor(config, db))
    const notRows = [42, null, 'a client', { ...aClient(), id: 'not-a-uuid' }, { ...aClient(), id: 7 }]
    const response = await sync(
      userId,
      req({
        clients: [aClient(), ...(notRows as unknown as SyncPushRow<'clients'>[])],
        settings: [{ person: 5 } as unknown as SyncPushRow<'settings'>]
      })
    )

    expect(response.rejected).toEqual([
      { table: 'clients', id: '', reason: 'forbidden' },
      { table: 'clients', id: '', reason: 'forbidden' },
      { table: 'clients', id: '', reason: 'forbidden' },
      { table: 'clients', id: 'not-a-uuid', reason: 'forbidden' },
      { table: 'clients', id: '', reason: 'forbidden' },
      { table: 'settings', id: '', reason: 'forbidden' }
    ])
    expect(rowsOf(response, 'clients').map((row) => row.id)).toEqual([id(1)])
    expect(rowsOf(response, 'settings')).toEqual([])
  })

  it('takes the device from the request, never from the row: a client cannot sign as another device', async () => {
    const { userId } = await signUp(appFor(config, db))
    const forged = { ...aClient(), updatedBy: DEVICE_B } as unknown as SyncPushRow<'clients'>
    const response = await sync(userId, req({ clients: [forged] }, { deviceId: DEVICE_A }))
    expect(response.rejected).toEqual([])
    expect(rowsOf(response, 'clients')).toEqual([{ ...aClient(), updatedBy: DEVICE_A }])

    /* And so B, at the same instant, still wins the tie it would have lost had the forgery stuck. */
    const fromB = await sync(userId, req({ clients: [aClient({ name: 'B wrote this' })] }, { since: response.cursor, deviceId: DEVICE_B }))
    expect(rowsOf(fromB, 'clients')[0]).toMatchObject({ name: 'B wrote this', updatedBy: DEVICE_B })
  })

  it('a version with no device of record loses every tie', async () => {
    const { userId } = await signUp(appFor(config, db))
    const first = await sync(userId, req({ clients: [aClient({ name: 'From before device ids' })] }))
    await db.db.execute(sql`UPDATE clients SET updated_by = NULL WHERE id = ${id(1)}`)

    const lowest = '00000000-0000-4000-8000-000000000000'
    const response = await sync(userId, req({ clients: [aClient({ name: 'Signed' })] }, { since: first.cursor, deviceId: lowest }))
    expect(rowsOf(response, 'clients')).toEqual([{ ...aClient({ name: 'Signed' }), updatedBy: lowest }])
    expect(response.cursor).toBeGreaterThan(first.cursor)
  })

  it('keeps one settings row per account, under the same rule', async () => {
    const { userId } = await signUp(appFor(config, db))
    const first = await sync(userId, req({ settings: [theSettings()] }))
    expect(rowsOf(first, 'settings')).toEqual([{ ...theSettings(), updatedBy: DEVICE_A }])

    const newer = await sync(userId, req({ settings: [theSettings({ updatedAt: T1, person: 'Alexandra' })] }, { since: first.cursor, deviceId: DEVICE_B }))
    expect(rowsOf(newer, 'settings')).toEqual([{ ...theSettings({ updatedAt: T1, person: 'Alexandra' }), updatedBy: DEVICE_B }])

    const older = await sync(userId, req({ settings: [theSettings({ updatedAt: T0, person: 'Al' })] }, { since: newer.cursor }))
    expect(rowsOf(older, 'settings')).toEqual([{ ...theSettings({ updatedAt: T1, person: 'Alexandra' }), updatedBy: DEVICE_B }])

    const count = await db.db.execute(sql`SELECT COUNT(*)::int AS n FROM settings`)
    expect(count.rows[0]?.n).toBe(1)
  })
})

describe('runSync: pulling', () => {
  it('pages the account’s rows by sequence, across tables, and walks to the end', async () => {
    const { userId } = await signUp(appFor(config, db))
    const clients = [1, 2, 3].map((n) => aClient({ id: id(n) }))
    const projects = [4, 5].map((n) => aProject({ id: id(n), clientId: id(1) }))
    await sync(userId, req({ clients, projects }))

    const seen: string[] = []
    let since = 0
    let pages = 0
    for (;;) {
      const page = await sync(userId, req({}, { since }), 2)
      pages += 1
      seen.push(...rowsOf(page, 'clients').map((row) => row.id), ...rowsOf(page, 'projects').map((row) => row.id))
      expect(page.cursor).toBeGreaterThanOrEqual(since)
      if (!page.hasMore) break
      expect(page.cursor).toBeGreaterThan(since)
      since = page.cursor
    }
    expect(pages).toBe(3)
    expect(seen).toEqual([id(1), id(2), id(3), id(4), id(5)])
  })

  it('a history that is an exact multiple of the page size ends on the last full page, not an empty one', async () => {
    const { userId } = await signUp(appFor(config, db))
    await sync(userId, req({ clients: [1, 2, 3, 4].map((n) => aClient({ id: id(n) })) }))

    const first = await sync(userId, req({}, { since: 0 }), 2)
    expect(first.hasMore).toBe(true)
    expect(rowsOf(first, 'clients').map((row) => row.id)).toEqual([id(1), id(2)])

    const second = await sync(userId, req({}, { since: first.cursor }), 2)
    expect(second.hasMore).toBe(false)
    expect(rowsOf(second, 'clients').map((row) => row.id)).toEqual([id(3), id(4)])
    expect(second.cursor).toBeGreaterThan(first.cursor)

    /* A client that asks once more anyway is told nothing, at the same place. */
    const third = await sync(userId, req({}, { since: second.cursor }), 2)
    expect(third).toEqual({ cursor: second.cursor, hasMore: false, changes: {}, rejected: [] })
  })

  it('sends the winner of a lost push once, even when the page already carries it', async () => {
    const { userId } = await signUp(appFor(config, db))
    await sync(userId, req({ clients: [aClient({ updatedAt: T1, name: 'Newer' })] }, { deviceId: DEVICE_B }))

    /* A has never pulled, so the page from 0 holds the winner already. */
    const response = await sync(userId, req({ clients: [aClient({ updatedAt: T0, name: 'Older' })] }, { since: 0, deviceId: DEVICE_A }))
    expect(rowsOf(response, 'clients')).toEqual([{ ...aClient({ updatedAt: T1, name: 'Newer' }), updatedBy: DEVICE_B }])
  })

  it('a cursor past everything held is honoured as it is, and answers nothing', async () => {
    const { userId } = await signUp(appFor(config, db))
    const first = await sync(userId, req({ clients: [aClient()] }))
    const response = await sync(userId, req({}, { since: first.cursor + 1000 }))
    expect(response).toEqual({ cursor: first.cursor + 1000, hasMore: false, changes: {}, rejected: [] })
  })

  it('returns nothing, and the same cursor, when there is nothing new', async () => {
    const { userId } = await signUp(appFor(config, db))
    const first = await sync(userId, req({ clients: [aClient()] }))
    const second = await sync(userId, req({}, { since: first.cursor }))
    expect(second).toEqual({ cursor: first.cursor, hasMore: false, changes: {}, rejected: [] })
  })

  it('never shows one account another’s rows', async () => {
    const app = appFor(config, db)
    const { userId: alexId } = await signUp(app, alex)
    const { userId: samId } = await signUp(app, sam)
    await sync(alexId, req({ clients: [aClient()] }))

    const samView = await sync(samId, req({}))
    expect(samView.changes).toEqual({})
    expect(samView.cursor).toBe(0)
  })

  it('lists a page parent tables first even when children were written earlier', async () => {
    const { userId } = await signUp(appFor(config, db))
    const first = await sync(userId, req({ clients: [aClient()], projects: [aProject()] }))
    /* The client is updated after the project, so its sequence is higher. */
    await sync(userId, req({ clients: [aClient({ updatedAt: T1 })] }, { since: first.cursor }))

    const page = await sync(userId, req({}, { since: 0 }))
    expect(Object.keys(page.changes)).toEqual(['clients', 'projects'])
  })
})

describe('runSync: under concurrency', () => {
  it('serialises an account’s syncs, so every row lands and every cursor is distinct', async () => {
    const { userId } = await signUp(appFor(config, db))
    const devices = [1, 2, 3, 4, 5].map((n) => `${n}${n}${n}${n}${n}${n}${n}${n}-0000-4000-8000-000000000000`)

    const responses = await Promise.all(
      devices.map((deviceId, n) => sync(userId, req({ clients: [aClient({ id: id(n + 1) })] }, { deviceId })))
    )

    const cursors = responses.map((response) => response.cursor).sort((a, b) => a - b)
    expect(new Set(cursors).size).toBe(5)

    const all = await sync(userId, req({}))
    expect(rowsOf(all, 'clients').map((row) => row.id).sort()).toEqual([1, 2, 3, 4, 5].map(id))
    expect(all.cursor).toBe(cursors[4])
  })

  it('serialises pushes of the same row, so the newest version stands whatever order they landed in', async () => {
    const { userId } = await signUp(appFor(config, db))
    const devices = [1, 2, 3, 4, 5].map((n) => `${n}${n}${n}${n}${n}${n}${n}${n}-0000-4000-8000-000000000000`)
    const at = (n: number): string => new Date(Date.parse(T0) + n * 60_000).toISOString()

    const responses = await Promise.all(
      devices.map((deviceId, n) =>
        sync(userId, req({ clients: [aClient({ updatedAt: at(n), name: `Version ${n}` })] }, { deviceId }))
      )
    )

    /* Every device was answered with either its own version or a newer one. */
    for (const [n, response] of responses.entries()) {
      const [row] = rowsOf(response, 'clients')
      expect(response.rejected).toEqual([])
      expect(Date.parse(row!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(at(n)))
    }

    const all = await sync(userId, req({}))
    expect(rowsOf(all, 'clients')).toEqual([{ ...aClient({ updatedAt: at(4), name: 'Version 4' }), updatedBy: devices[4] }])
    const count = await db.db.execute(sql`SELECT COUNT(*)::int AS n FROM clients`)
    expect(count.rows[0]?.n).toBe(1)
  })
})

describe('POST /sync', () => {
  it('needs a bearer token', async () => {
    const app = appFor(config, db)
    await signUp(app)
    const response = await request(app).post('/sync').send(req({}))
    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('unauthorized')
  })

  it('answers a bad body as a validation failure', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)
    const response = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ protocolVersion: 1, deviceId: 'nope', since: 0, changes: {} })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation')
  })

  it('refuses a table it does not know as a validation failure, not a server error', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)
    const response = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...req({}), changes: { widgets: [] } })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation')
  })

  it('a body with no protocol version at all is a bad body, not a client to upgrade', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)
    const { protocolVersion: _, ...without } = req({})
    const response = await request(app).post('/sync').set('Authorization', `Bearer ${token}`).send(without)
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation')
  })

  it('tells a client on another protocol version to upgrade', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)
    const response = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...req({}), protocolVersion: 0 })
    expect(response.status).toBe(426)
    expect(response.body.error.code).toBe('upgrade_required')
  })

  it('syncs, and takes a body far bigger than a sign-up form', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)
    /* A settings logo is a data URL; a couple of megabytes is an ordinary PNG. */
    const logo = `data:image/png;base64,${'A'.repeat(2 * 1024 * 1024)}`
    const response = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send(req({ clients: [aClient()], settings: [theSettings({ logo })] }))

    expect(response.status).toBe(200)
    expect(response.body.rejected).toEqual([])
    expect(response.body.changes.clients).toHaveLength(1)
    expect(response.body.changes.settings[0].logo).toBe(logo)
    expect(response.body.hasMore).toBe(false)
  })

  it('pages by the configured size', async () => {
    const app = appFor({ ...config, syncPageSize: 2 }, db)
    const { token } = await signUp(app)
    const clients = [1, 2, 3].map((n) => aClient({ id: id(n) }))
    const first = await request(app).post('/sync').set('Authorization', `Bearer ${token}`).send(req({ clients }))
    expect(first.status).toBe(200)
    expect(first.body.hasMore).toBe(true)
    expect(first.body.changes.clients).toHaveLength(2)
  })
})
