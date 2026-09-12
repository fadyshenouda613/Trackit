import { z } from 'zod'
import type { ApiErrorCode } from '@trackit/shared/api'
import {
  mintedInvoiceNumberSchema,
  syncResponseSchema,
  type MintedInvoiceNumber,
  type SyncRequest,
  type SyncResponse
} from '@trackit/shared/schemas'

/*
 * The server's two sync-side calls: POST /sync, and the mint that issues an
 * invoice number. Each answer is parsed with the shared schema before
 * anything trusts it, and everything that goes wrong is a SyncClientError
 * with one of the bridge's codes — plus `upgrade_required`, the server's
 * way of saying this build's protocol is no longer spoken.
 */

export type SyncTransport = {
  push: (accessToken: string, request: SyncRequest) => Promise<SyncResponse>
  /** `POST /invoices/:id/number` — the same number again if this invoice already asked. */
  mintNumber: (accessToken: string, invoiceId: string, scheme: string) => Promise<MintedInvoiceNumber>
}

export type SyncClientCode = ApiErrorCode | 'upgrade_required'

export class SyncClientError extends Error {
  constructor(
    readonly code: SyncClientCode,
    message: string
  ) {
    super(message)
    this.name = 'SyncClientError'
  }
}

const errorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() })
})

const knownCodes: ReadonlySet<SyncClientCode> = new Set<SyncClientCode>([
  'validation',
  'unauthorized',
  'conflict',
  'not_found',
  'rate_limited',
  'upgrade_required',
  'internal'
])

const toCode = (code: string): SyncClientCode =>
  knownCodes.has(code as SyncClientCode) ? (code as SyncClientCode) : 'internal'

/** A sync can carry a page of rows each way; it gets longer than a sign-in. */
const SYNC_TIMEOUT_MS = 60_000
/** A mint is one row each way. */
const MINT_TIMEOUT_MS = 15_000

export type SyncClientOptions = {
  baseUrl: string
  /** Replaced by the tests. */
  fetch?: typeof fetch
}

export function createSyncClient(options: SyncClientOptions): SyncTransport {
  const base = options.baseUrl.replace(/\/+$/, '')
  const fetchImpl = options.fetch ?? fetch

  /** One POST: the body as JSON, the token, the timeout; the answer as JSON or a SyncClientError. */
  const post = async (path: string, accessToken: string, body: unknown, timeoutMs: number): Promise<unknown> => {
    let response: Response
    try {
      response = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new SyncClientError('offline', `Trackit could not reach the server (${reason})`)
    }

    let json: unknown = null
    try {
      json = await response.json()
    } catch {
      json = null
    }

    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(json)
      if (parsed.success) throw new SyncClientError(toCode(parsed.data.error.code), parsed.data.error.message)
      throw new SyncClientError('internal', `The server answered ${response.status}`)
    }
    return json
  }

  const unreadable = (): SyncClientError =>
    new SyncClientError('internal', 'The server answered with something this app cannot read')

  return {
    push: async (accessToken, request) => {
      const parsed = syncResponseSchema.safeParse(await post('/sync', accessToken, request, SYNC_TIMEOUT_MS))
      if (!parsed.success) throw unreadable()
      return parsed.data
    },
    mintNumber: async (accessToken, invoiceId, scheme) => {
      const parsed = mintedInvoiceNumberSchema.safeParse(
        await post(`/invoices/${invoiceId}/number`, accessToken, { scheme }, MINT_TIMEOUT_MS)
      )
      if (!parsed.success) throw unreadable()
      return parsed.data
    }
  }
}
