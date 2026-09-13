import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { SyncPushRow } from '@trackit/shared/schemas'
import { appFor, closeTestPdf, openTestDb, testConfig, type TestDb } from '../test-support'

/*
 * The invoice routes against a real Postgres and a real browser: who may
 * render an invoice, and how numbers are handed out. See test-support.ts
 * for where the database comes from.
 */

const config = testConfig()
let db: TestDb

beforeAll(async () => {
  db = await openTestDb(config)
})
afterAll(async () => {
  await closeTestPdf()
  await db.close()
})
beforeEach(() => db.reset())

const alex = { name: 'Alex Marchetti', email: 'alex@trackit.studio', password: 'correct horse battery' }
const sam = { name: 'Sam Okafor', email: 'sam@trackit.studio', password: 'another fine passphrase' }

async function signUp(app: ReturnType<typeof appFor>, person = alex): Promise<{ userId: string; token: string }> {
  const response = await request(app).post('/auth/register').send(person).expect(201)
  return { userId: response.body.user.id, token: response.body.tokens.accessToken }
}

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const T0 = '2026-09-10T09:00:00.000Z'

const aClient = (): SyncPushRow<'clients'> => ({
  id: id(1),
  name: 'Priya Raghunathan',
  company: 'Northwind Studio',
  email: 'priya@northwindstudio.com',
  phone: '',
  address: '14 Brick Lane\nLondon E1 6RF',
  currency: 'GBP',
  paymentTermsDays: 14,
  notes: '',
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null
})

const anInvoice = (overrides: Partial<SyncPushRow<'invoices'>> = {}): SyncPushRow<'invoices'> => ({
  id: id(3),
  clientId: id(1),
  number: 'INV-0147',
  numberProvisional: false,
  pdfGeneratedAt: null,
  status: 'sent',
  currency: 'GBP',
  issuedAt: T0,
  dueAt: '2026-09-24T09:00:00.000Z',
  taxRate: 0,
  subtotalCents: 460000,
  taxCents: 0,
  totalCents: 460000,
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
  id: id(4),
  invoiceId: id(3),
  projectId: null,
  milestoneId: null,
  label: 'Editorial grid and master pages',
  amountCents: 460000,
  sortOrder: 1,
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...overrides
})

/** Uploads rows the way a device would, so the routes see what a sync leaves. */
async function upload(
  app: ReturnType<typeof appFor>,
  token: string,
  changes: { clients?: SyncPushRow<'clients'>[]; invoices?: SyncPushRow<'invoices'>[]; invoice_lines?: SyncPushRow<'invoice_lines'>[] }
): Promise<void> {
  const response = await request(app)
    .post('/sync')
    .set('Authorization', `Bearer ${token}`)
    .send({ protocolVersion: 1, deviceId: DEVICE, since: 0, changes })
    .expect(200)
  expect(response.body.rejected).toEqual([])
}

describe('GET /invoices/:id/pdf', () => {
  it('renders the owner a PDF, and answers 404 for anyone else and 401 for nobody', async () => {
    const app = appFor(config, db)
    const owner = await signUp(app)
    const other = await signUp(app, sam)
    await upload(app, owner.token, { clients: [aClient()], invoices: [anInvoice()], invoice_lines: [aLine()] })

    const mine = await request(app)
      .get(`/invoices/${id(3)}/pdf`)
      .set('Authorization', `Bearer ${owner.token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => callback(null, Buffer.concat(chunks)))
      })
    expect(mine.status).toBe(200)
    expect(mine.headers['content-type']).toBe('application/pdf')
    expect(mine.headers['content-disposition']).toBe('attachment; filename="INV-0147.pdf"')
    expect((mine.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-')
    expect((mine.body as Buffer).length).toBeGreaterThan(10_000)

    const theirs = await request(app).get(`/invoices/${id(3)}/pdf`).set('Authorization', `Bearer ${other.token}`)
    expect(theirs.status).toBe(404)
    expect(theirs.body).toEqual({ error: { code: 'not_found', message: expect.any(String) } })

    const nobody = await request(app).get(`/invoices/${id(3)}/pdf`)
    expect(nobody.status).toBe(401)
    expect(nobody.body.error.code).toBe('unauthorized')
  }, 60_000)

  it('answers 404 for an invoice that does not exist, and 400 for an id that is not one', async () => {
    const app = appFor(config, db)
    const owner = await signUp(app)
    const missing = await request(app).get(`/invoices/${id(9)}/pdf`).set('Authorization', `Bearer ${owner.token}`)
    expect(missing.status).toBe(404)
    const junk = await request(app).get('/invoices/not-an-id/pdf').set('Authorization', `Bearer ${owner.token}`)
    expect(junk.status).toBe(400)
    expect(junk.body.error.code).toBe('validation')
  })
})

describe('POST /invoices/:id/number', () => {
  const mint = (app: ReturnType<typeof appFor>, token: string, invoiceId: string, scheme = 'INV-0000') =>
    request(app).post(`/invoices/${invoiceId}/number`).set('Authorization', `Bearer ${token}`).send({ scheme })

  it('hands out the next number under the scheme, once per invoice', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)

    const first = await mint(app, token, id(10))
    expect(first.status).toBe(200)
    expect(first.body).toEqual({ invoiceId: id(10), number: 'INV-0001' })

    const second = await mint(app, token, id(11))
    expect(second.body.number).toBe('INV-0002')

    /* The same invoice asking again — a lost response — gets the same answer. */
    const again = await mint(app, token, id(10))
    expect(again.body.number).toBe('INV-0001')
    const third = await mint(app, token, id(12))
    expect(third.body.number).toBe('INV-0003')
  })

  it('counts the numbers already uploaded, and ignores provisional ones', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)
    await upload(app, token, {
      clients: [aClient()],
      invoices: [
        anInvoice({ id: id(3), number: 'INV-0147' }),
        /* A tombstone still counts: the number went out once. */
        anInvoice({ id: id(5), number: 'INV-0148', deletedAt: T0 }),
        /* A guess never confirmed does not: it is exactly what the mint replaces. */
        anInvoice({ id: id(6), number: 'INV-0300', numberProvisional: true, status: 'draft', issuedAt: null, dueAt: null })
      ]
    })

    const minted = await mint(app, token, id(6))
    expect(minted.body.number).toBe('INV-0149')
  })

  it('keeps accounts apart, and refuses a scheme that cannot count', async () => {
    const app = appFor(config, db)
    const alexSession = await signUp(app)
    const samSession = await signUp(app, sam)

    expect((await mint(app, alexSession.token, id(10))).body.number).toBe('INV-0001')
    expect((await mint(app, samSession.token, id(11))).body.number).toBe('INV-0001')
    /* Sam cannot take Alex's invoice id. */
    expect((await mint(app, samSession.token, id(10))).status).toBe(409)

    const bad = await mint(app, alexSession.token, id(12), 'INV-')
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('validation')

    const dated = await mint(app, alexSession.token, id(13), '{YYYY}-000')
    expect(dated.body.number).toMatch(/^\d{4}-001$/)
  })

  it('serialises with a sync on the same account, so an upload cannot slip past the count', async () => {
    const app = appFor(config, db)
    const { token, userId } = await signUp(app)
    await upload(app, token, { clients: [aClient()], invoices: [anInvoice({ id: id(3), number: 'INV-0001' })] })

    const minted = await mint(app, token, id(20))
    expect(minted.body.number).toBe('INV-0002')

    const rows = await db.db.execute(sql`SELECT number FROM invoice_numbers WHERE user_id = ${userId}`)
    expect(rows.rows).toEqual([{ number: 'INV-0002' }])
  })

  it('hands each of several simultaneous requests its own number', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)
    const answers = await Promise.all([20, 21, 22, 23, 24].map((n) => mint(app, token, id(n))))
    expect(answers.map((answer) => answer.status)).toEqual([200, 200, 200, 200, 200])
    expect(answers.map((answer) => answer.body.number).sort()).toEqual([
      'INV-0001',
      'INV-0002',
      'INV-0003',
      'INV-0004',
      'INV-0005'
    ])
  })

  it('reserves by invoice, not by scheme; a new scheme counts on its own and grows past its padding', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)
    await upload(app, token, { clients: [aClient()], invoices: [anInvoice({ number: 'INV-0147' })] })

    expect((await mint(app, token, id(10))).body.number).toBe('INV-0148')
    /* The same invoice asking under another scheme gets the number it was already promised. */
    expect((await mint(app, token, id(10), '{YYYY}-000')).body.number).toBe('INV-0148')
    /* Another invoice under that scheme starts its own count: nothing above was its number. */
    expect((await mint(app, token, id(11), '{YYYY}-000')).body.number).toMatch(/^\d{4}-001$/)

    await upload(app, token, { invoices: [anInvoice({ id: id(5), number: 'INV-9999' })] })
    expect((await mint(app, token, id(12))).body.number).toBe('INV-10000')
  })

  it('answers 401 for nobody and 400 for an id that is not one', async () => {
    const app = appFor(config, db)
    const { token } = await signUp(app)
    const nobody = await request(app).post(`/invoices/${id(10)}/number`).send({ scheme: 'INV-0000' })
    expect(nobody.status).toBe(401)
    const junk = await mint(app, token, 'not-an-id')
    expect(junk.status).toBe(400)
    expect(junk.body.error.code).toBe('validation')
  })
})
