import type {
  AuthSession,
  AuthStatus,
  AuthUser,
  LoginInput,
  RegisterInput
} from '@trackit/shared/schemas'
import { AuthClientError, type AuthClient } from './client'
import type { SessionStore, StoredSession } from './session-store'

/*
 * The account on this machine, as the main process holds it.
 *
 * Three facts, and the rules between them:
 *
 *   stored   the session file: who, and the refresh token. Written on sign-in,
 *            rewritten on every refresh (the token rotates), removed on
 *            sign-out. Its absence is "signed out".
 *   access   a short-lived token in memory, never on disk. Fetched through
 *            the refresh token when something needs one — the sync engine —
 *            and again when it is about to expire.
 *   session  `active` or `expired`. Active on trust from the moment a session
 *            is stored; only a server refusing the refresh token makes it
 *            expired. Being offline never does: a machine on a train for a
 *            week is still signed in, and finds out it still is on reconnect.
 *
 * None of this touches the database. An expired session withholds the
 * access token, which is the one thing the sync engine needs and the one
 * thing the local screens do not.
 */

export type AuthService = {
  status: () => AuthStatus
  register: (input: RegisterInput) => Promise<AuthUser>
  login: (input: LoginInput) => Promise<AuthUser>
  /** Forgets the session here first; tells the server if it can be reached. */
  logout: () => Promise<void>
  /**
   * A live access token, refreshed through the store when the one in hand
   * is within a minute of expiry. Throws AuthClientError: `unauthorized`
   * when signed out or expired, `offline` when a refresh was needed and the
   * server could not be reached — in which case the session stays active.
   */
  accessToken: () => Promise<string>
  /**
   * Confirms a stored session with the server by rotating its token. Meant
   * for launch: a network failure is swallowed, a refusal marks the session
   * expired and pushes the change.
   */
  verify: () => Promise<void>
}

export type AuthServiceDeps = {
  client: AuthClient
  store: SessionStore
  /** Pushed on every move of the status. */
  onChanged: (status: AuthStatus) => void
  /** Epoch ms; the tests hand in their own. */
  now?: () => number
}

/** Refresh this far ahead of the access token's expiry, so a call in flight never carries a dead one. */
const REFRESH_AHEAD_MS = 60_000

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const now = deps.now ?? (() => Date.now())

  let stored: StoredSession | null = deps.store.read()
  let access: { token: string; expiresAt: number } | null = null
  /* A refresh token whose own expiry has passed is known dead without asking. */
  let session: 'active' | 'expired' =
    stored && Date.parse(stored.refreshExpiresAt) <= now() ? 'expired' : 'active'
  /* One refresh at a time: two callers wanting a token share the same trip. */
  let inflight: Promise<AuthSession> | null = null

  const status = (): AuthStatus =>
    stored ? { state: 'signedIn', user: stored.user, session } : { state: 'signedOut' }

  const emit = (): void => deps.onChanged(status())

  /** Takes what the server issued: the file, the access token, the state. */
  const adopt = (issued: AuthSession): void => {
    stored = {
      user: issued.user,
      refreshToken: issued.tokens.refreshToken,
      refreshExpiresAt: issued.tokens.refreshExpiresAt
    }
    deps.store.write(stored)
    access = { token: issued.tokens.accessToken, expiresAt: Date.parse(issued.tokens.accessExpiresAt) }
    session = 'active'
    /* A refresh still out for the previous session answers to nobody now. */
    inflight = null
  }

  const refresh = (): Promise<AuthSession> => {
    if (inflight) return inflight
    const current = stored
    if (!current) return Promise.reject(new AuthClientError('unauthorized', 'Not signed in'))

    const trip: Promise<AuthSession> = deps.client
      .refresh(current.refreshToken)
      .then((issued) => {
        /* Signed out, or signed in afresh, while this trip was out: what it
           brought back belongs to a session this machine no longer holds,
           and adopting it would sign the machine back in behind the
           renderer's back. */
        if (stored !== current) throw new AuthClientError('unauthorized', 'Signed out while refreshing')
        const was = session
        adopt(issued)
        if (was !== 'active') emit()
        return issued
      })
      .catch((error: unknown) => {
        if (stored !== current) throw error
        if (error instanceof AuthClientError && error.code === 'unauthorized') {
          /* The server has said no. The file stays — it still says who this
             is — but the token in it is dead, and the status says so. */
          access = null
          if (session !== 'expired') {
            session = 'expired'
            emit()
          }
        }
        /* Anything else — offline, a 500, a rate limit — is a bad moment,
           not a bad session. Nothing changes. */
        throw error
      })
      .finally(() => {
        /* Only this trip's own slot: a sign-out or sign-in meanwhile has
           already let go of it, and may have started a newer one. */
        if (inflight === trip) inflight = null
      })
    inflight = trip
    return trip
  }

  return {
    status,

    register: async (input) => {
      const issued = await deps.client.register(input)
      adopt(issued)
      emit()
      return issued.user
    },

    login: async (input) => {
      const issued = await deps.client.login(input)
      adopt(issued)
      emit()
      return issued.user
    },

    logout: async () => {
      const token = stored?.refreshToken ?? null
      deps.store.clear()
      stored = null
      access = null
      session = 'active'
      inflight = null
      emit()
      /* Best effort. The machine is signed out either way; the server
         revoking the family as well is the ideal, not the condition. */
      if (token) await deps.client.logout(token).catch(() => undefined)
    },

    accessToken: async () => {
      if (!stored) throw new AuthClientError('unauthorized', 'Not signed in')
      if (session === 'expired') throw new AuthClientError('unauthorized', 'This session has expired; sign in again')
      if (access && access.expiresAt - now() > REFRESH_AHEAD_MS) return access.token
      const issued = await refresh()
      return issued.tokens.accessToken
    },

    verify: async () => {
      if (!stored || session === 'expired') return
      await refresh().catch(() => undefined)
    }
  }
}
