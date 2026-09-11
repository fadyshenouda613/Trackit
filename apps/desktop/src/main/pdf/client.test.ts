import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPdfClient, PdfClientError } from './client'

let dir: string
const INVOICE = '00000000-0000-4000-8000-000000000003'

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trackit-pdf-client-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const failWith = async (run: () => Promise<void>): Promise<PdfClientError> => {
  try {
    await run()
  } catch (error) {
    if (error instanceof PdfClientError) return error
    throw error
  }
  throw new Error('expected a PdfClientError')
}

describe('createPdfClient', () => {
  it('gets the document with the bearer token and streams it to the file', async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const client = createPdfClient({
      baseUrl: 'http://server.test/',
      fetch: async (url, init) => {
        seen = { url: String(url), init: init ?? {} }
        return new Response('%PDF-1.7 bytes', { status: 200, headers: { 'content-type': 'application/pdf' } })
      }
    })
    const file = join(dir, 'out.pdf')
    await client.download('the-token', INVOICE, file)

    expect(seen!.url).toBe(`http://server.test/invoices/${INVOICE}/pdf`)
    expect(new Headers(seen!.init.headers).get('authorization')).toBe('Bearer the-token')
    expect(readFileSync(file, 'utf8')).toBe('%PDF-1.7 bytes')
  })

  it('is offline when no response comes at all', async () => {
    const client = createPdfClient({
      baseUrl: 'http://server.test',
      fetch: async () => {
        throw new TypeError('fetch failed')
      }
    })
    const error = await failWith(() => client.download('t', INVOICE, join(dir, 'out.pdf')))
    expect(error.code).toBe('offline')
    expect(existsSync(join(dir, 'out.pdf'))).toBe(false)
  })

  it('carries the server’s code, and calls anything else internal', async () => {
    const respond = (status: number, body: unknown) =>
      createPdfClient({
        baseUrl: 'http://server.test',
        fetch: async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
      })
    const notFound = await failWith(() => respond(404, { error: { code: 'not_found', message: 'no' } }).download('t', INVOICE, join(dir, 'a.pdf')))
    expect(notFound.code).toBe('not_found')
    const unauthorized = await failWith(() => respond(401, { error: { code: 'unauthorized', message: 'no' } }).download('t', INVOICE, join(dir, 'b.pdf')))
    expect(unauthorized.code).toBe('unauthorized')
    const odd = await failWith(() => respond(502, 'bad gateway').download('t', INVOICE, join(dir, 'c.pdf')))
    expect(odd.code).toBe('internal')
  })
})
