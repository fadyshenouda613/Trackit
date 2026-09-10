import { z } from 'zod'
import type { ApiErrorCode } from '@trackit/shared/api'
import { authSessionSchema, type AuthSession, type LoginInput, type RegisterInput } from '@trackit/shared/schemas'

/*
 * The server's account routes, as four calls. Everything that comes back is
 * parsed with the shared schema before it is trusted, and everything that
 * goes wrong is an AuthClientError with one of the bridge's own codes, so
 * the renderer states the refusal without knowing there was an HTTP.
 */

export type AuthClient = {
  register: (input: RegisterInput) => Promise<AuthSession>
  login: (input: LoginInput) => Promise<AuthSession>
  refresh: (refreshToken: string) => Promise<AuthSession>
  logout: (refreshToken: string) => Promise<void>
}

export class AuthClientError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AuthClientError'
  }
}

/** The server's error shape. Anything else in a failed body is an `internal`. */
const errorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() })
})

/** The server's codes are the bridge's own, bar the ones it never sends. */
const serverCodes: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  'validation',
  'unauthorized',
  'conflict',
  'not_found',
  'rate_limited',
  'internal'
])

const toCode = (code: string): ApiErrorCode => (serverCodes.has(code as ApiErrorCode) ? (code as ApiErrorCode) : 'internal')

/** How long a call may take before it is reported as no connection. */
const TIMEOUT_MS = 15_000

export type AuthClientOptions = {
  baseUrl: string
  /** Replaced by the tests. */
  fetch?: typeof fetch
}

export function createAuthClient(options: AuthClientOptions): AuthClient {
  const base = options.baseUrl.replace(/\/+$/, '')
  const fetchImpl = options.fetch ?? fetch

  const post = async (path: string, body: unknown): Promise<unknown> => {
    let response: Response
    try {
      response = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    } catch (error) {
      /* fetch rejects only when no response came at all: no network, no DNS,
         a refused port, the timeout. All of those are "offline" to the person. */
      const reason = error instanceof Error ? error.message : String(error)
      throw new AuthClientError('offline', `Trackit could not reach your account (${reason})`)
    }

    if (response.status === 204) return null

    let json: unknown = null
    try {
      json = await response.json()
    } catch {
      json = null
    }

    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(json)
      if (parsed.success) throw new AuthClientError(toCode(parsed.data.error.code), parsed.data.error.message)
      throw new AuthClientError('internal', `The server answered ${response.status}`)
    }
    return json
  }

  const session = (json: unknown): AuthSession => {
    const parsed = authSessionSchema.safeParse(json)
    if (!parsed.success) throw new AuthClientError('internal', 'The server answered with something this app cannot read')
    return parsed.data
  }

  return {
    register: async (input) => session(await post('/auth/register', input)),
    login: async (input) => session(await post('/auth/login', input)),
    refresh: async (refreshToken) => session(await post('/auth/refresh', { refreshToken })),
    logout: async (refreshToken) => {
      await post('/auth/logout', { refreshToken })
    }
  }
}
