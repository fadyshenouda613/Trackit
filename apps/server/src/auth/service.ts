import { randomUUID } from 'node:crypto'
import argon2 from 'argon2'
import { and, eq, isNull } from 'drizzle-orm'
import type { AuthSession, AuthUser, LoginInput, RegisterInput } from '@trackit/shared/schemas'
import type { Db } from '../db'
import { refreshTokens, users } from '../db/schema'
import { AppError } from '../errors'
import { hashToken, newRefreshToken, signAccessToken } from './tokens'

/*
 * Accounts and sessions, as plain functions over a database handle — the
 * same arrangement as the desktop's repositories, and for the same reason:
 * they are tested against a database, not through HTTP.
 *
 * A session is a family of refresh tokens. Signing in starts a family;
 * every refresh adds a link and retires the one presented; signing out
 * revokes the family. Presenting a retired link is the one thing that
 * must never work, and it does more than fail: it revokes the whole family,
 * on the theory that a token turning up twice means someone other than its
 * owner has it.
 */

export type AuthDeps = {
  db: Db
  jwtSecret: string
  accessTokenTtlSeconds: number
  refreshTokenTtlDays: number
  /** The clock, so the tests can move it. */
  now: () => Date
}

/** Every refusal of a credential says the same thing, whichever half was wrong. */
const WRONG_PAIR = 'That email and password do not match'
const DEAD_SESSION = 'This session is no longer valid; sign in again'

const DAY_MS = 24 * 60 * 60 * 1000

type UserRow = typeof users.$inferSelect

const toAuthUser = (user: UserRow): AuthUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt.toISOString()
})

/**
 * A hash to verify against when the email is unknown, so an unknown email
 * costs the caller the same time as a wrong password. Computed once, on
 * first use, from a value nobody holds.
 */
let dummyHash: Promise<string> | null = null
const dummy = (): Promise<string> => (dummyHash ??= argon2.hash(randomUUID(), { type: argon2.argon2id }))

/**
 * Postgres's unique-violation code, the only error register expects. Drizzle
 * wraps the driver's error, so the code is on the cause, one or two down.
 */
const isUniqueViolation = (error: unknown): boolean => {
  for (let current = error, depth = 0; typeof current === 'object' && current !== null && depth < 4; depth += 1) {
    if ('code' in current && (current as { code: unknown }).code === '23505') return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

/** Starts (or continues) a family: one new refresh token row and an access token. */
async function issue(deps: AuthDeps, user: UserRow, familyId: string): Promise<AuthSession> {
  const now = deps.now()
  const raw = newRefreshToken()
  const refreshExpiresAt = new Date(now.getTime() + deps.refreshTokenTtlDays * DAY_MS)
  const id = randomUUID()

  await deps.db.insert(refreshTokens).values({
    id,
    userId: user.id,
    familyId,
    tokenHash: hashToken(raw),
    expiresAt: refreshExpiresAt,
    createdAt: now
  })
  const access = await signAccessToken(
    deps.jwtSecret,
    { userId: user.id, familyId },
    deps.accessTokenTtlSeconds,
    now
  )

  return {
    user: toAuthUser(user),
    tokens: {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt.toISOString(),
      refreshToken: raw,
      refreshExpiresAt: refreshExpiresAt.toISOString()
    }
  }
}

export async function register(deps: AuthDeps, input: RegisterInput): Promise<AuthSession> {
  const now = deps.now()
  const row: UserRow = {
    id: randomUUID(),
    email: input.email,
    name: input.name,
    passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
    createdAt: now,
    updatedAt: now
  }
  try {
    await deps.db.insert(users).values(row)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, 'conflict', 'An account with this email already exists')
    }
    throw error
  }
  return issue(deps, row, randomUUID())
}

export async function login(deps: AuthDeps, input: LoginInput): Promise<AuthSession> {
  const [user] = await deps.db.select().from(users).where(eq(users.email, input.email)).limit(1)
  /* Verified either way — see dummy(). The result is read only when there is a user. */
  const matches = await argon2.verify(user?.passwordHash ?? (await dummy()), input.password)
  if (!user || !matches) throw new AppError(401, 'unauthorized', WRONG_PAIR)
  return issue(deps, user, randomUUID())
}

/**
 * Trades a live refresh token for a fresh pair. Everything that can go wrong
 * is the same 401 — a caller learns nothing about why — but what happens
 * inside differs: a token that was already rotated or revoked takes its
 * whole family down with it.
 */
export async function refresh(deps: AuthDeps, rawToken: string): Promise<AuthSession> {
  const now = deps.now()
  const tokenHash = hashToken(rawToken)

  /*
   * The refusal is decided inside the transaction but thrown after it: a
   * throw would roll the transaction back, and the one thing reuse must do —
   * revoke the family — has to be committed for the refusal to mean anything.
   */
  const outcome = await deps.db.transaction(async (tx) => {
    /* Locked for the rest of the transaction, so two refreshes of the same
       token cannot both be told it is live. */
    const [row] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1)
      .for('update')
    if (!row) return null

    if (row.revokedAt !== null || row.replacedById !== null) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)))
      return null
    }

    if (row.expiresAt.getTime() <= now.getTime()) return null

    const [owner] = await tx.select().from(users).where(eq(users.id, row.userId)).limit(1)
    if (!owner) return null

    /* The successor is inserted here rather than by issue() so that the old
       link's replacedById and the new link land in the same transaction. */
    const successor = randomUUID()
    const raw = newRefreshToken()
    const refreshExpiresAt = new Date(now.getTime() + deps.refreshTokenTtlDays * DAY_MS)
    await tx.insert(refreshTokens).values({
      id: successor,
      userId: row.userId,
      familyId: row.familyId,
      tokenHash: hashToken(raw),
      expiresAt: refreshExpiresAt,
      createdAt: now
    })
    await tx
      .update(refreshTokens)
      .set({ revokedAt: now, replacedById: successor })
      .where(eq(refreshTokens.id, row.id))

    return { owner, familyId: row.familyId, raw, refreshExpiresAt }
  })
  if (!outcome) throw new AppError(401, 'unauthorized', DEAD_SESSION)

  const access = await signAccessToken(
    deps.jwtSecret,
    { userId: outcome.owner.id, familyId: outcome.familyId },
    deps.accessTokenTtlSeconds,
    now
  )
  return {
    user: toAuthUser(outcome.owner),
    tokens: {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt.toISOString(),
      refreshToken: outcome.raw,
      refreshExpiresAt: outcome.refreshExpiresAt.toISOString()
    }
  }
}

/** Revokes the family the token belongs to. Unknown tokens are ignored: signing out cannot fail. */
export async function logout(deps: AuthDeps, rawToken: string): Promise<void> {
  const [row] = await deps.db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(rawToken)))
    .limit(1)
  if (!row) return
  await deps.db
    .update(refreshTokens)
    .set({ revokedAt: deps.now() })
    .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)))
}

/** Whether the family an access token names is still live — a signed-out family is not. */
export async function familyIsLive(deps: AuthDeps, familyId: string): Promise<boolean> {
  const [row] = await deps.db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
    .limit(1)
  return row !== undefined
}

export async function userById(deps: AuthDeps, id: string): Promise<AuthUser | null> {
  const [user] = await deps.db.select().from(users).where(eq(users.id, id)).limit(1)
  return user ? toAuthUser(user) : null
}
