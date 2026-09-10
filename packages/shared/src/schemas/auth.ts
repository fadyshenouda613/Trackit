/*
 * An account, and the shapes that cross the network to get one.
 *
 * The account exists so a person can sign back in and so the sync engine has
 * someone to sync for. It is not a gate on the local data: the desktop reads
 * and writes its database whether or not the token in its pocket is still
 * good, and everything here is only ever consulted when something has to
 * reach the server.
 */
import { z } from 'zod'
import { idSchema, timestampSchema } from './primitives'

/** Lower-cased and trimmed by the parser, so one address has one spelling. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email())

/** The shortest password sign-up will take. The card states it from here. */
export const PASSWORD_MIN_LENGTH = 8
/** Argon2 hashes any length; the cap is only so a request cannot carry a novel. */
export const PASSWORD_MAX_LENGTH = 128

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)

export const registerInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: passwordSchema
})
export type RegisterInput = z.infer<typeof registerInputSchema>

/**
 * A wrong password and a short one are refused the same way at sign-in, so
 * the length rule is not applied here: it would tell a guesser something.
 */
export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH)
})
export type LoginInput = z.infer<typeof loginInputSchema>

/** The opaque refresh token, exactly as it was issued. */
export const refreshTokenSchema = z.string().min(1).max(512)

export const refreshInputSchema = z.object({ refreshToken: refreshTokenSchema })
export type RefreshInput = z.infer<typeof refreshInputSchema>

export const logoutInputSchema = z.object({ refreshToken: refreshTokenSchema })
export type LogoutInput = z.infer<typeof logoutInputSchema>

/** What the server says about a person. Never the hash, never the tokens. */
export const authUserSchema = z.object({
  id: idSchema,
  email: emailSchema,
  name: z.string(),
  createdAt: timestampSchema
})
export type AuthUser = z.infer<typeof authUserSchema>

/**
 * A short-lived access token and the long-lived refresh token that earns the
 * next one. Both expiries travel with them so the client never has to decode
 * a JWT to know when to ask again.
 */
export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  accessExpiresAt: timestampSchema,
  refreshToken: refreshTokenSchema,
  refreshExpiresAt: timestampSchema
})
export type AuthTokens = z.infer<typeof authTokensSchema>

/** What register, login and refresh answer with. */
export const authSessionSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema
})
export type AuthSession = z.infer<typeof authSessionSchema>

/**
 * What the desktop knows about its own account, as the renderer reads it
 * over the bridge.
 *
 *   signedOut  no session on this machine
 *   signedIn   a session, and whether the server still honours it:
 *              `active` until proven otherwise — a long stretch offline
 *              never demotes it — and `expired` once the server has refused
 *              the refresh token. Expired blocks syncing and nothing else.
 */
export const authSessionStateSchema = z.enum(['active', 'expired'])
export type AuthSessionState = z.infer<typeof authSessionStateSchema>

export const authStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('signedOut') }),
  z.object({ state: z.literal('signedIn'), user: authUserSchema, session: authSessionStateSchema })
])
export type AuthStatus = z.infer<typeof authStatusSchema>
