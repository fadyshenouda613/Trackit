import { describe, expect, it } from 'vitest'
import type { SyncRequest } from '@trackit/shared/schemas'
import { createSyncClient, SyncClientError } from './client'

const request: SyncRequest = {
  protocolVersion: 1,
  deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  since: 12,
  changes: {}
}

const ok = { cursor: 12, hasMore: false, changes: {}, rejected: [] }

const respond = (status: number, body: unknown): typeof fetch => {
  return async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const failWith = async (client: ReturnType<typeof createSyncClient>): Promise<SyncClientError> => {
  try {
    await client.push('token', request)
  } catch (error) {
    if (error instanceof SyncClientError) return error
    throw error
  }
  throw new Error('expected a SyncClientError')
}

describe('createSyncClient', () => {
  it('posts the request as JSON with the bearer token and parses the response', async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const fetchImpl: typeof fetch = async (url, init) => {
      seen = { url: String(url), init: init ?? {} }
      return new Response(JSON.stringify(ok), { status: 200 })
    }
    const client = createSyncClient({ baseUrl: 'http://server.test/', fetch: fetchImpl })
    const response = await client.push('the-token', request)

    expect(response).toEqual(ok)
    expect(seen!.url).toBe('http://server.test/sync')
    expect(seen!.init.method).toBe('POST')
    expect(new Headers(seen!.init.headers).get('authorization')).toBe('Bearer the-token')
    expect(JSON.parse(seen!.init.body as string)).toEqual(request)
  })

  it('is offline when no response comes at all', async () => {
    const client = createSyncClient({
      baseUrl: 'http://server.test',
      fetch: async () => {
        throw new TypeError('fetch failed')
      }
    })
    expect((await failWith(client)).code).toBe('offline')
  })

  it('carries the server’s code, including the one that means this build is too old', async () => {
    const unauthorized = createSyncClient({
      baseUrl: 'http://server.test',
      fetch: respond(401, { error: { code: 'unauthorized', message: 'no' } })
    })
    expect((await failWith(unauthorized)).code).toBe('unauthorized')

    const old = createSyncClient({
      baseUrl: 'http://server.test',
      fetch: respond(426, { error: { code: 'upgrade_required', message: 'speak 2' } })
    })
    expect((await failWith(old)).code).toBe('upgrade_required')
  })

  it('treats an answer it cannot read as internal', async () => {
    const garbage = createSyncClient({ baseUrl: 'http://server.test', fetch: respond(200, { cursor: 'twelve' }) })
    expect((await failWith(garbage)).code).toBe('internal')

    const crashed = createSyncClient({ baseUrl: 'http://server.test', fetch: respond(502, 'Bad Gateway') })
    expect((await failWith(crashed)).code).toBe('internal')
  })

  it('refuses a page naming a table this build does not know, rather than applying the rest', async () => {
    const newer = createSyncClient({
      baseUrl: 'http://server.test',
      fetch: respond(200, { ...ok, changes: { widgets: [] } })
    })
    expect((await failWith(newer)).code).toBe('internal')
  })

  it('maps a code it does not know to internal, never to one that means something', async () => {
    const odd = createSyncClient({
      baseUrl: 'http://server.test',
      fetch: respond(418, { error: { code: 'teapot', message: 'short and stout' } })
    })
    const error = await failWith(odd)
    expect(error.code).toBe('internal')
    expect(error.message).toBe('short and stout')
  })

  it('asks for an invoice number at the invoice’s own path, with the scheme, and reads the answer', async () => {
    let seen: { url: string; body: unknown } | null = null
    const fetchImpl: typeof fetch = async (url, init) => {
      seen = { url: String(url), body: JSON.parse(String(init?.body)) }
      return new Response(JSON.stringify({ invoiceId: request.deviceId, number: 'INV-0042' }), { status: 200 })
    }
    const client = createSyncClient({ baseUrl: 'http://server.test', fetch: fetchImpl })
    const minted = await client.mintNumber('the-token', request.deviceId, 'INV-0000')
    expect(minted).toEqual({ invoiceId: request.deviceId, number: 'INV-0042' })
    expect(seen!.url).toBe(`http://server.test/invoices/${request.deviceId}/number`)
    expect(seen!.body).toEqual({ scheme: 'INV-0000' })

    const unreadable = createSyncClient({ baseUrl: 'http://server.test', fetch: respond(200, { number: 42 }) })
    await expect(unreadable.mintNumber('t', request.deviceId, 'INV-0000')).rejects.toMatchObject({ code: 'internal' })
  })
})
