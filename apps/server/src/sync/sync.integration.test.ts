import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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

async function signUp(app: ReturnType<typeof appFor>, person = alex): Promise<{ userId: string; token: string }> {
  const response = await request(app).post('/auth/register').send(person).expect(201)
  return { userId: response.body.user.id, token: response.body.tokens.accessToken }
}

describe('the sequence', () => {
  it('is one sequence across every table, and every write takes a fresh value', async () => {
    const app = appFor(config, db)
    const { userId } = await signUp(app)
    const at = new Date('2026-09-10T09:00:00.000Z')

    await db.db.execute(sql`
      INSERT INTO clients (id, user_id, created_at, updated_at, name, currency)
      VALUES ('00000000-0000-4000-8000-000000000001', ${userId}, ${at}, ${at}, 'Studio Nord', 'EUR')`)
    await db.db.execute(sql`
      INSERT INTO projects (id, user_id, created_at, updated_at, client_id, name, price_cents, currency, status)
      VALUES ('00000000-0000-4000-8000-000000000002', ${userId}, ${at}, ${at},
              '00000000-0000-4000-8000-000000000001', 'Brand refresh', 650000, 'EUR', 'draft')`)

    const client = await db.db.execute(sql`SELECT server_seq FROM clients`)
    const project = await db.db.execute(sql`SELECT server_seq FROM projects`)
    const clientSeq = Number(client.rows[0]?.server_seq)
    const projectSeq = Number(project.rows[0]?.server_seq)
    expect(projectSeq).toBe(clientSeq + 1)

    /* The per-table sequences are gone: the shared one is the only one left. */
    const sequences = await db.db.execute(sql`SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'`)
    expect(sequences.rows.map((row) => row.sequence_name)).toEqual(['sync_seq'])
  })
})
