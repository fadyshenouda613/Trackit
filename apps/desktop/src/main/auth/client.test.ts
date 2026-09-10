import { describe, expect, it } from 'vitest'
import { createAuthClient } from './client'

const user = {
  id: '4f1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  email: 'alex@trackit.studio',
  name: 'Alex Marchetti',
  createdAt: '2026-08-28T09:15:00.000Z'
}
const tokens = {
  accessToken: 'access',
  accessExpiresAt: '2026-09-09T09:15:00.000Z',
  refreshToken: 'refresh',
  refreshExpiresAt: '2026-12-08T09:00:00.000Z'
}

type Call = { url: string; init: RequestInit }

/** A fetch that answers one canned response and remembers what it was asked. */
function fakeFetch(status: number, body: unknown, calls: Call[] = []): { fetch: typeof fetch; calls: Call[] } {
  const stub = ((url: string, init: RequestInit) => {
    calls.push({ url, init })
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
      })
    )
  }) as unknown as typeof fetch
  return { fetch: stub, calls }
}

describe('auth client', () => {
  it('posts JSON to the route and parses the session it gets back', async () => {
    const { fetch, calls } = fakeFetch(200, { user, tokens, extra: 'ignored' })
    const client = createAuthClient({ baseUrl: 'https://api.example/', fetch })

    const session = await client.login({ email: 'alex@trackit.studio', password: 'pw' })
    expect(session).toEqual({ user, tokens })
    expect(calls[0].url).toBe('https://api.example/auth/login')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: 'alex@trackit.studio', password: 'pw' })
  })

  it('turns the server refusal into the bridge code and message', async () => {
    const { fetch } = fakeFetch(401, { error: { code: 'unauthorized', message: 'That email and password do not match' } })
    const client = createAuthClient({ baseUrl: 'https://api.example', fetch })

    await expect(client.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      name: 'AuthClientError',
      code: 'unauthorized',
      message: 'That email and password do not match'
    })
  })

  it('maps a taken email, a rate limit, and a code it does not know', async () => {
    const at = (status: number, code: string) =>
      createAuthClient({ baseUrl: 'x', fetch: fakeFetch(status, { error: { code, message: 'm' } }).fetch })
    await expect(at(409, 'conflict').register({ name: 'A', email: 'a@b.co', password: 'longenough' })).rejects.toMatchObject({ code: 'conflict' })
    await expect(at(429, 'rate_limited').refresh('t')).rejects.toMatchObject({ code: 'rate_limited' })
    await expect(at(418, 'teapot').refresh('t')).rejects.toMatchObject({ code: 'internal' })
  })

  it('reports a body it cannot read as internal, whatever the status', async () => {
    const ok = createAuthClient({ baseUrl: 'x', fetch: fakeFetch(200, { hello: 'world' }).fetch })
    await expect(ok.refresh('t')).rejects.toMatchObject({ code: 'internal' })
    const bad = createAuthClient({ baseUrl: 'x', fetch: fakeFetch(502, 'Bad Gateway').fetch })
    await expect(bad.refresh('t')).rejects.toMatchObject({ code: 'internal', message: 'The server answered 502' })
  })

  it('reports no response at all as offline', async () => {
    const stub = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch
    const client = createAuthClient({ baseUrl: 'x', fetch: stub })
    await expect(client.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      code: 'offline',
      message: expect.stringContaining('fetch failed')
    })
  })

  it('takes a 204 from logout as done', async () => {
    const { fetch, calls } = fakeFetch(204, null)
    await expect(createAuthClient({ baseUrl: 'x', fetch }).logout('t')).resolves.toBeUndefined()
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ refreshToken: 't' })
  })
})
