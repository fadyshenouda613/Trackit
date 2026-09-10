import { describe, expect, it } from 'vitest'
import type { AuthSession, AuthStatus } from '@trackit/shared/schemas'
import { AuthClientError, type AuthClient } from './client'
import { createAuthService } from './service'
import type { SessionStore, StoredSession } from './session-store'

/*
 * The service against a client and a store that are both in memory, with
 * the clock in hand. What is being checked is the rules: when the file is
 * written, when the status moves, and that a bad moment is never mistaken
 * for a bad session.
 */

const user = {
  id: '4f1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  email: 'alex@trackit.studio',
  name: 'Alex Marchetti',
  createdAt: '2026-08-28T09:15:00.000Z'
}

const T0 = Date.parse('2026-09-09T09:00:00.000Z')
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** A session the server would issue at `at`: access for 15 minutes, refresh for 90 days. */
const issued = (at: number, tag: string): AuthSession => ({
  user,
  tokens: {
    accessToken: `access-${tag}`,
    accessExpiresAt: new Date(at + 15 * MINUTE).toISOString(),
    refreshToken: `refresh-${tag}`,
    refreshExpiresAt: new Date(at + 90 * DAY).toISOString()
  }
})

function memoryStore(initial: StoredSession | null = null): SessionStore & { current: () => StoredSession | null } {
  let held = initial
  return {
    read: () => held,
    write: (session) => {
      held = session
    },
    clear: () => {
      held = null
    },
    current: () => held
  }
}

type Script = Partial<{ [K in keyof AuthClient]: AuthClient[K] }>

/** A client whose every call is unexpected unless scripted. */
const client = (script: Script): AuthClient => ({
  register: script.register ?? (() => Promise.reject(new Error('unexpected register'))),
  login: script.login ?? (() => Promise.reject(new Error('unexpected login'))),
  refresh: script.refresh ?? (() => Promise.reject(new Error('unexpected refresh'))),
  logout: script.logout ?? (() => Promise.reject(new Error('unexpected logout')))
})

const stored: StoredSession = { user, refreshToken: 'refresh-old', refreshExpiresAt: new Date(T0 + 30 * DAY).toISOString() }

function harness(script: Script, initial: StoredSession | null, at = T0) {
  const store = memoryStore(initial)
  const changes: AuthStatus[] = []
  let now = at
  const service = createAuthService({
    client: client(script),
    store,
    onChanged: (status) => changes.push(status),
    now: () => now
  })
  return { service, store, changes, tick: (ms: number) => (now += ms) }
}

describe('auth service', () => {
  it('is signed out with no file, and signed in — active, on trust — with one', () => {
    expect(harness({}, null).service.status()).toEqual({ state: 'signedOut' })
    expect(harness({}, stored).service.status()).toEqual({ state: 'signedIn', user, session: 'active' })
  })

  it('knows a refresh token past its own expiry is dead without asking', () => {
    const { service } = harness({}, stored, T0 + 31 * DAY)
    expect(service.status()).toEqual({ state: 'signedIn', user, session: 'expired' })
  })

  it('signs in: writes the file, holds the access token, pushes the status', async () => {
    const { service, store, changes } = harness({ login: () => Promise.resolve(issued(T0, 'a')) }, null)

    await expect(service.login({ email: user.email, password: 'pw' })).resolves.toEqual(user)
    expect(store.current()).toEqual({
      user,
      refreshToken: 'refresh-a',
      refreshExpiresAt: issued(T0, 'a').tokens.refreshExpiresAt
    })
    expect(changes).toEqual([{ state: 'signedIn', user, session: 'active' }])
    /* The access token is in hand: no refresh needed. */
    await expect(service.accessToken()).resolves.toBe('access-a')
  })

  it('leaves nothing behind when sign-in is refused', async () => {
    const { service, store, changes } = harness(
      { login: () => Promise.reject(new AuthClientError('unauthorized', 'no')) },
      null
    )
    await expect(service.login({ email: user.email, password: 'pw' })).rejects.toMatchObject({ code: 'unauthorized' })
    expect(store.current()).toBeNull()
    expect(changes).toEqual([])
  })

  it('refreshes ahead of expiry and rotates the stored token', async () => {
    const calls: string[] = []
    const { service, store, tick } = harness(
      {
        login: () => Promise.resolve(issued(T0, 'a')),
        refresh: (token) => {
          calls.push(token)
          return Promise.resolve(issued(T0 + 14 * MINUTE, 'b'))
        }
      },
      null
    )
    await service.login({ email: user.email, password: 'pw' })

    tick(13 * MINUTE)
    await expect(service.accessToken()).resolves.toBe('access-a')
    tick(1 * MINUTE + 1)
    /* Within a minute of expiry: refreshed with the old refresh token, and the file rotates. */
    await expect(service.accessToken()).resolves.toBe('access-b')
    expect(calls).toEqual(['refresh-a'])
    expect(store.current()?.refreshToken).toBe('refresh-b')
  })

  it('shares one refresh between callers who ask at once', async () => {
    let refreshes = 0
    const { service } = harness(
      {
        refresh: () => {
          refreshes += 1
          return Promise.resolve(issued(T0, 'b'))
        }
      },
      stored
    )
    const [a, b] = await Promise.all([service.accessToken(), service.accessToken()])
    expect(a).toBe('access-b')
    expect(b).toBe('access-b')
    expect(refreshes).toBe(1)
  })

  it('stays signed in and active when the server cannot be reached', async () => {
    const { service, store, changes } = harness(
      { refresh: () => Promise.reject(new AuthClientError('offline', 'no network')) },
      stored
    )
    await expect(service.accessToken()).rejects.toMatchObject({ code: 'offline' })
    expect(service.status()).toEqual({ state: 'signedIn', user, session: 'active' })
    expect(store.current()).toEqual(stored)
    expect(changes).toEqual([])

    /* verify() at launch swallows the same failure. */
    await expect(service.verify()).resolves.toBeUndefined()
    expect(service.status().state).toBe('signedIn')
  })

  it('marks the session expired, once, when the server refuses the refresh token', async () => {
    let refreshes = 0
    const { service, store, changes } = harness(
      {
        refresh: () => {
          refreshes += 1
          return Promise.reject(new AuthClientError('unauthorized', 'dead'))
        }
      },
      stored
    )
    await service.verify()
    expect(service.status()).toEqual({ state: 'signedIn', user, session: 'expired' })
    expect(changes).toEqual([{ state: 'signedIn', user, session: 'expired' }])
    /* The file stays: Settings still names the person, and the data is theirs. */
    expect(store.current()).toEqual(stored)

    /* From here the token is withheld without another trip. */
    await expect(service.accessToken()).rejects.toMatchObject({ code: 'unauthorized' })
    expect(refreshes).toBe(1)
    expect(changes).toHaveLength(1)
  })

  it('comes back to active when a fresh sign-in replaces an expired session', async () => {
    const { service, changes } = harness(
      {
        refresh: () => Promise.reject(new AuthClientError('unauthorized', 'dead')),
        login: () => Promise.resolve(issued(T0, 'n'))
      },
      stored
    )
    await service.verify()
    await service.login({ email: user.email, password: 'pw' })
    expect(service.status()).toEqual({ state: 'signedIn', user, session: 'active' })
    expect(changes.map((change) => (change.state === 'signedIn' ? change.session : 'out'))).toEqual(['expired', 'active'])
    await expect(service.accessToken()).resolves.toBe('access-n')
  })

  it('signs out locally first, then tells the server, and shrugs if it cannot', async () => {
    const told: string[] = []
    const { service, store, changes } = harness(
      {
        logout: (token) => {
          told.push(token)
          return Promise.reject(new AuthClientError('offline', 'no network'))
        }
      },
      stored
    )
    await expect(service.logout()).resolves.toBeUndefined()
    expect(store.current()).toBeNull()
    expect(service.status()).toEqual({ state: 'signedOut' })
    expect(changes).toEqual([{ state: 'signedOut' }])
    expect(told).toEqual(['refresh-old'])
    await expect(service.accessToken()).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('signing out with no session is a no-op that still says so', async () => {
    const { service, changes } = harness({}, null)
    await service.logout()
    expect(changes).toEqual([{ state: 'signedOut' }])
  })
})
