import { describe, expect, it } from 'vitest'
import { hashToken, newRefreshToken, signAccessToken, verifyAccessToken } from './tokens'

const SECRET = 'a-test-secret-of-at-least-thirty-two-characters'
const claims = { userId: '4f1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', familyId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e' }

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
