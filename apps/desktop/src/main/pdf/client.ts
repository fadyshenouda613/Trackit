import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { z } from 'zod'
import type { ApiErrorCode } from '@trackit/shared/api'

/*
 * GET /invoices/:id/pdf, streamed to a file. The bytes never sit in memory
 * as one buffer: the response body is piped straight to the path the
 * caller names, which is a part-file the service renames into place once
 * the stream has ended cleanly. Everything that goes wrong is a
 * PdfClientError with one of the bridge's codes, so the rail can state it
 * without reading a status code.
 */

export type PdfTransport = {
  download: (accessToken: string, invoiceId: string, toFile: string) => Promise<void>
}

export class PdfClientError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'PdfClientError'
  }
}

const errorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() })
})

const serverCodes: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  'validation',
  'unauthorized',
  'not_found',
  'rate_limited',
  'internal'
])

const toCode = (code: string): ApiErrorCode => (serverCodes.has(code as ApiErrorCode) ? (code as ApiErrorCode) : 'internal')

/** A render launches a browser page and prints it; longer than a sign-in, shorter than a sync. */
const TIMEOUT_MS = 60_000

export type PdfClientOptions = {
  baseUrl: string
  /** Replaced by the tests. */
  fetch?: typeof fetch
}

export function createPdfClient(options: PdfClientOptions): PdfTransport {
  const base = options.baseUrl.replace(/\/+$/, '')
  const fetchImpl = options.fetch ?? fetch

  return {
    download: async (accessToken, invoiceId, toFile) => {
      let response: Response
      try {
        response = await fetchImpl(`${base}/invoices/${invoiceId}/pdf`, {
          method: 'GET',
          headers: { accept: 'application/pdf', authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(TIMEOUT_MS)
        })
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new PdfClientError('offline', `Trackit could not reach the server (${reason})`)
      }

      if (!response.ok) {
        let json: unknown = null
        try {
          json = await response.json()
        } catch {
          json = null
        }
        const parsed = errorBodySchema.safeParse(json)
        if (parsed.success) throw new PdfClientError(toCode(parsed.data.error.code), parsed.data.error.message)
        throw new PdfClientError('internal', `The server answered ${response.status}`)
      }

      if (!response.body) throw new PdfClientError('internal', 'The server answered with no document')
      try {
        await pipeline(Readable.fromWeb(response.body as WebReadableStream), createWriteStream(toFile))
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new PdfClientError('offline', `The download did not finish (${reason})`)
      }
    }
  }
}
