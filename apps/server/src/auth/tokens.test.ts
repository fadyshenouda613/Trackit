import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { hashToken, newRefreshToken, signAccessToken, verifyAccessToken } from './tokens'

const SECRET = 'a-test-secret-of-at-least-thirty-two-characters'
const claims = { userId: '4f1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', familyId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e' }

const b64url = (value: string | object): string =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
const decode = (segment: string): Record<string, unknown> => JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))

/** A token in the server's own shape but signed some other way, for the refusals. */
const signedAs = (
  alg: 'HS256' | 'HS384' | 'HS512',
  secret: string,
  issuer = 'trackit',
  payload: Record<string, unknown> = { sid: claims.familyId }
) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setSubject(claims.userId)
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret))

describe('access tokens', () => {
  it('round-trip through the same secret', async () => {
    /* Issued now: jose judges `exp` by the real clock, not the one handed in. */
    const now = new Date()
    const { token, expiresAt } = await signAccessToken(SECRET, claims, 900, now)
    expect(expiresAt.getTime()).toBe(Math.floor(now.getTime() / 1000) * 1000 + 900_000)
    expect(await verifyAccessToken(SECRET, token)).toEqual(claims)
  })

  it('are refused under another secret, after expiry, and when not a token at all', async () => {
    const live = await signAccessToken(SECRET, claims, 900, new Date())
    expect(await verifyAccessToken('another-secret-of-at-least-thirty-two-chars', live.token)).toBeNull()

    const stale = await signAccessToken(SECRET, claims, 60, new Date(Date.now() - 120_000))
    expect(await verifyAccessToken(SECRET, stale.token)).toBeNull()

    expect(await verifyAccessToken(SECRET, 'not.a.token')).toBeNull()
  })

  it('carry the user, the family and the standard claims, and nothing about the account', async () => {
    const { token } = await signAccessToken(SECRET, claims, 900, new Date())
    const [header, payload] = token.split('.').slice(0, 2).map((segment) => decode(segment))
    expect(header).toEqual({ alg: 'HS256' })
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'iss', 'sid', 'sub'])
    expect(payload).toMatchObject({ sub: claims.userId, sid: claims.familyId, iss: 'trackit' })
    expect(payload.exp).toBe((payload.iat as number) + 900)
  })

  it('are refused unsigned, under another algorithm, from another issuer, and without a family', async () => {
    /* `alg: none` with the real claims: a verifier that honoured the header would accept it. */
    const unsigned = `${b64url({ alg: 'none' })}.${b64url({ sub: claims.userId, sid: claims.familyId, iss: 'trackit', exp: Math.floor(Date.now() / 1000) + 900 })}.`
    expect(await verifyAccessToken(SECRET, unsigned)).toBeNull()

    /* The right secret is not enough: only HS256 is accepted. */
    expect(await verifyAccessToken(SECRET, await signedAs('HS384', SECRET))).toBeNull()
    expect(await verifyAccessToken(SECRET, await signedAs('HS512', SECRET))).toBeNull()
    /* And the control: the same shape under HS256 is what the server itself issues. */
    expect(await verifyAccessToken(SECRET, await signedAs('HS256', SECRET))).toEqual(claims)

    expect(await verifyAccessToken(SECRET, await signedAs('HS256', SECRET, 'someone-else'))).toBeNull()
    expect(await verifyAccessToken(SECRET, await signedAs('HS256', SECRET, 'trackit', {}))).toBeNull()
    expect(await verifyAccessToken(SECRET, await signedAs('HS256', SECRET, 'trackit', { sid: 42 }))).toBeNull()
  })

  it('are refused when the payload is changed under a real signature', async () => {
    const { token } = await signAccessToken(SECRET, claims, 900, new Date())
    const [header, payload, signature] = token.split('.')
    const other = { ...decode(payload), sub: '00000000-0000-4000-8000-000000000000' }
    expect(await verifyAccessToken(SECRET, `${header}.${b64url(other)}.${signature}`)).toBeNull()
    /* The signature alone is not what is checked either: the untouched token still passes. */
    expect(await verifyAccessToken(SECRET, `${header}.${payload}.${signature}`)).toEqual(claims)
  })

  it('allow no clock skew: a token is dead the second its expiry arrives', async () => {
    /* ttl 0 puts `exp` at the current second, which is already "not after now". */
    const { token } = await signAccessToken(SECRET, claims, 0, new Date())
    expect(await verifyAccessToken(SECRET, token)).toBeNull()
    const { token: barely } = await signAccessToken(SECRET, claims, 2, new Date())
    expect(await verifyAccessToken(SECRET, barely)).toEqual(claims)
  })
})

describe('refresh tokens', () => {
  it('are random, url-safe, and stored only as a hash', () => {
    const a = newRefreshToken()
    const b = newRefreshToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(a)).toBe(hashToken(a))
    expect(hashToken(a)).not.toBe(hashToken(b))
  })
})
