import { z } from 'zod'
import type { ApiErrorCode } from '@trackit/shared/api'
import { syncResponseSchema, type SyncRequest, type SyncResponse } from '@trackit/shared/schemas'

/*
 * POST /sync, as one call. The answer is parsed with the shared schema
 * before anything trusts it, and everything that goes wrong is a
 * SyncClientError with one of the bridge's codes — plus `upgrade_required`,
 * the server's way of saying this build's protocol is no longer spoken.
 */

export type SyncTransport = {
  push: (accessToken: string, request: SyncRequest) => Promise<SyncResponse>
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
const TIMEOUT_MS = 60_000

export type SyncClientOptions = {
  baseUrl: string
  /** Replaced by the tests. */
  fetch?: typeof fetch
}

export function createSyncClient(options: SyncClientOptions): SyncTransport {
  const base = options.baseUrl.replace(/\/+$/, '')
  const fetchImpl = options.fetch ?? fetch

  return {
    push: async (accessToken, request) => {
      let response: Response
      try {
        response = await fetchImpl(`${base}/sync`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(TIMEOUT_MS)
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

      const parsed = syncResponseSchema.safeParse(json)
      if (!parsed.success) {
        throw new SyncClientError('internal', 'The server answered with something this app cannot read')
      }
      return parsed.data
    }
  }
}
