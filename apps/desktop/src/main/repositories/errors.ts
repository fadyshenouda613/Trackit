import type { ApiErrorCode } from '@trackit/shared/api'

/**
 * The codes a repository can refuse with. Validation failures are Zod's to
 * raise, `internal` is anything unexpected, and `detached` belongs to the
 * renderer's stand-in bridge; the rest are rules of the ledger.
 */
export type RepositoryErrorCode = Exclude<ApiErrorCode, 'validation' | 'internal' | 'detached'>

/**
 * A rule refusing an operation. Repositories throw these; the IPC layer
 * turns them into `{ ok: false, error }` so nothing throws across the bridge.
 */
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode

  constructor(code: RepositoryErrorCode, message: string) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
  }
}
