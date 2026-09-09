import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../db'
import { appFor, openTestDb, testConfig, type TestDb } from '../test-support'

/*
 * The account routes against a real Postgres. See test-support.ts for where
 * the database comes from.
 */

const config = testConfig()
let db: TestDb

beforeAll(async () => {
  db = await openTestDb(config)
})
afterAll(() => db.close())
beforeEach(() => db.reset())

const alex = { name: 'Alex Marchetti', email: 'alex@trackit.studio', password: 'correct horse battery' }

describe('POST /auth/register', () => {
  it('makes the account and signs it in', async () => {
    const app = appFor(config, db)
    const response = await request(app).post('/auth/register').send(alex)

    expect(response.status).toBe(201)
    expect(response.body.user).toMatchObject({ email: alex.email, name: alex.name })
    expect(response.body.user.passwordHash).toBeUndefined()
    expect(response.body.tokens.accessToken).toEqual(expect.any(String))
    expect(response.body.tokens.refreshToken).toEqual(expect.any(String))
    expect(new Date(response.body.tokens.refreshExpiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('refuses a second account on the same email, however it is spelled', async () => {
    const app = appFor(config, db)
    await request(app).post('/auth/register').send(alex).expect(201)
    const response = await request(app)
      .post('/auth/register')
      .send({ ...alex, email: '  ALEX@Trackit.Studio ' })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({
      error: { code: 'conflict', message: expect.stringContaining('already exists') }
    })
  })

  it('names the fields a bad body is missing, in the one error shape', async () => {
    const response = await request(appFor(config, db))
      .post('/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation')
    const paths = response.body.error.details.map((issue: { path: string }) => issue.path)
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']))
  })

  it('answers malformed JSON as a validation failure, not a crash', async () => {
    const response = await request(appFor(config, db))
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name": ')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation')
  })
})

describe('POST /auth/login', () => {
  it('signs in with the right pair and refuses either half wrong the same way', async () => {
    const app = appFor(config, db)
    await request(app).post('/auth/register').send(alex).expect(201)

    const ok = await request(app).post('/auth/login').send({ email: alex.email, password: alex.password })
    expect(ok.status).toBe(200)
    expect(ok.body.user.email).toBe(alex.email)

    const wrongPassword = await request(app).post('/auth/login').send({ email: alex.email, password: 'nope' })
    const unknownEmail = await request(app).post('/auth/login').send({ email: 'who@example.com', password: alex.password })
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body).toEqual(unknownEmail.body)
    expect(wrongPassword.body.error.code).toBe('unauthorized')
  })

  it('starts a new family on every sign-in', async () => {
    const app = appFor(config, db)
    const first = await request(app).post('/auth/register').send(alex)
    const second = await request(app).post('/auth/login').send({ email: alex.email, password: alex.password })

    /* Signing out one family leaves the other alone. */
    await request(app).post('/auth/logout').send({ refreshToken: first.body.tokens.refreshToken }).expect(204)
    await request(app).post('/auth/refresh').send({ refreshToken: first.body.tokens.refreshToken }).expect(401)
    await request(app).post('/auth/refresh').send({ refreshToken: second.body.tokens.refreshToken }).expect(200)
  })
})

describe('POST /auth/refresh', () => {
  it('rotates: a new pair comes back and the old refresh token is spent', async () => {
    const app = appFor(config, db)
    const signedUp = await request(app).post('/auth/register').send(alex)
    const original = signedUp.body.tokens.refreshToken

    const rotated = await request(app).post('/auth/refresh').send({ refreshToken: original })
    expect(rotated.status).toBe(200)
    expect(rotated.body.tokens.refreshToken).not.toBe(original)
    expect(rotated.body.user.email).toBe(alex.email)

    /* The successor works. */
    const again = await request(app).post('/auth/refresh').send({ refreshToken: rotated.body.tokens.refreshToken })
    expect(again.status).toBe(200)
  })

  it('treats a spent token turning up again as theft and revokes the whole family', async () => {
    const app = appFor(config, db)
    const signedUp = await request(app).post('/auth/register').send(alex)
    const original = signedUp.body.tokens.refreshToken

    const rotated = await request(app).post('/auth/refresh').send({ refreshToken: original }).expect(200)
    const successor = rotated.body.tokens.refreshToken

    /* The original again: refused, and it takes the successor down with it. */
    const reuse = await request(app).post('/auth/refresh').send({ refreshToken: original })
    expect(reuse.status).toBe(401)
    expect(reuse.body.error.code).toBe('unauthorized')

    const collateral = await request(app).post('/auth/refresh').send({ refreshToken: successor })
    expect(collateral.status).toBe(401)

    /* And the access token issued with the successor no longer opens /me. */
    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${rotated.body.tokens.accessToken}`)
      .expect(401)
  })

  it('refuses an unknown token and an expired one', async () => {
    let now = new Date('2026-09-09T09:00:00.000Z')
    const app = appFor(config, db, () => now)
    const signedUp = await request(app).post('/auth/register').send(alex)

    await request(app).post('/auth/refresh').send({ refreshToken: 'not-a-token' }).expect(401)

    now = new Date(now.getTime() + (config.refreshTokenTtlDays + 1) * 24 * 60 * 60 * 1000)
    const expired = await request(app).post('/auth/refresh').send({ refreshToken: signedUp.body.tokens.refreshToken })
    expect(expired.status).toBe(401)
  })

  it('extends the session on every rotation, so a machine only has to reach the server now and then', async () => {
    let now = new Date('2026-09-09T09:00:00.000Z')
    const app = appFor(config, db, () => now)
    const signedUp = await request(app).post('/auth/register').send(alex)
    const firstExpiry = new Date(signedUp.body.tokens.refreshExpiresAt).getTime()

    now = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    const rotated = await request(app).post('/auth/refresh').send({ refreshToken: signedUp.body.tokens.refreshToken })
    expect(rotated.status).toBe(200)
    expect(new Date(rotated.body.tokens.refreshExpiresAt).getTime()).toBeGreaterThan(firstExpiry)
  })
})

describe('POST /auth/logout', () => {
  it('revokes the family and always answers 204', async () => {
    const app = appFor(config, db)
    const signedUp = await request(app).post('/auth/register').send(alex)
    const { refreshToken, accessToken } = signedUp.body.tokens

    await request(app).post('/auth/logout').send({ refreshToken }).expect(204)
    await request(app).post('/auth/refresh').send({ refreshToken }).expect(401)
    await request(app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401)

    /* A second time, or a token that never existed: still 204. */
    await request(app).post('/auth/logout').send({ refreshToken }).expect(204)
    await request(app).post('/auth/logout').send({ refreshToken: 'never-issued' }).expect(204)
  })
})

describe('GET /auth/me', () => {
  it('answers with the user behind a live access token', async () => {
    const app = appFor(config, db)
    const signedUp = await request(app).post('/auth/register').send(alex)

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${signedUp.body.tokens.accessToken}`)
    expect(me.status).toBe(200)
    expect(me.body).toEqual({ user: signedUp.body.user })
  })

  it('refuses no token, a forged token, and an expired one', async () => {
    let now = new Date('2026-09-09T09:00:00.000Z')
    const app = appFor(config, db, () => now)
    const signedUp = await request(app).post('/auth/register').send(alex)
    const { accessToken } = signedUp.body.tokens

    await request(app).get('/auth/me').expect(401)
    await request(app).get('/auth/me').set('Authorization', 'Bearer not.a.jwt').expect(401)

    const forged = appFor({ ...config, jwtSecret: 'another-secret-that-is-also-thirty-two-characters' }, db)
    await request(forged).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401)

    /* jose checks `exp` against the real clock, so the token has to have been
       issued in the past for the expiry to have gone by. */
    now = new Date(Date.now() - (config.accessTokenTtlSeconds + 60) * 1000)
    const stale = await request(app).post('/auth/login').send({ email: alex.email, password: alex.password })
    await request(app).get('/auth/me').set('Authorization', `Bearer ${stale.body.tokens.accessToken}`).expect(401)
  })
})

describe('hardening', () => {
  it('rate-limits the credential routes per address, in the same error shape', async () => {
    const app = appFor(testConfig({ authRateLimit: { max: 3, windowMs: 60_000 } }), db)
    const attempt = () => request(app).post('/auth/login').send({ email: alex.email, password: 'x' })

    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401)
    const limited = await attempt()
    expect(limited.status).toBe(429)
    expect(limited.body).toEqual({
      error: { code: 'rate_limited', message: expect.stringContaining('Too many attempts') }
    })
    expect(limited.headers['ratelimit']).toBeDefined()
  })

  it('answers an unknown route in the error shape', async () => {
    const response = await request(appFor(config, db)).get('/nothing-here')
    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: { code: 'not_found', message: 'No route for GET /nothing-here' } })
  })

  it('sends the security headers and only the allowed origin', async () => {
    const app = appFor(testConfig({ corsOrigins: ['https://app.example'] }), db)

    const allowed = await request(app).get('/health').set('Origin', 'https://app.example')
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example')
    expect(allowed.headers['x-content-type-options']).toBe('nosniff')
    expect(allowed.headers['x-powered-by']).toBeUndefined()

    const other = await request(app).get('/health').set('Origin', 'https://elsewhere.example')
    expect(other.status).toBe(200)
    expect(other.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('keeps an unexpected error to one line in production', async () => {
    /* A handle that cannot connect makes /health/ready the one route that
       fails for a reason the server did not expect. */
    const broken = connect('postgres://nobody:x@127.0.0.1:1/none')
    const response = await request(appFor({ ...testConfig(), env: 'production' }, broken)).get('/health/ready')
    await broken.close()

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: { code: 'internal', message: 'Something went wrong' } })
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED')
  })

  it('says what went wrong outside production', async () => {
    const broken = connect('postgres://nobody:x@127.0.0.1:1/none')
    const response = await request(appFor(testConfig(), broken)).get('/health/ready')
    await broken.close()

    expect(response.status).toBe(500)
    expect(response.body.error.code).toBe('internal')
    expect(response.body.error.message).not.toBe('Something went wrong')
  })

  it('reports readiness from the database', async () => {
    const response = await request(appFor(config, db)).get('/health/ready')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
  })
})
