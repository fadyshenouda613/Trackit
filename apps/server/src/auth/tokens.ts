import { createHash, randomBytes } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'

/*
 * The two kinds of token, as pure functions over bytes and a secret.
 *
 * An access token is a short-lived HS256 JWT: it proves who is calling for
 * the next few minutes and is never stored anywhere. A refresh token is 32
 * random bytes the client keeps and the server remembers only as a hash —
 * so a copy of the database yields nothing that can be presented.
 */

const ISSUER = 'trackit'

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

export const newRefreshToken = (): string => randomBytes(32).toString('base64url')

export type AccessClaims = {
  userId: string
  /** The refresh-token family the access token was issued under. */
  familyId: string
}

const key = (secret: string): Uint8Array => new TextEncoder().encode(secret)

export async function signAccessToken(
  secret: string,
  claims: AccessClaims,
  ttlSeconds: number,
  now: Date
): Promise<{ token: string; expiresAt: Date }> {
  const issued = Math.floor(now.getTime() / 1000)
  const expiresAt = new Date((issued + ttlSeconds) * 1000)
  const token = await new SignJWT({ sid: claims.familyId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt(issued)
    .setExpirationTime(issued + ttlSeconds)
    .sign(key(secret))
  return { token, expiresAt }
}

/** The claims of a token this secret signed and that has not expired; null for anything else. */
export async function verifyAccessToken(secret: string, token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null
    return { userId: payload.sub, familyId: payload.sid }
  } catch {
    return null
  }
}
