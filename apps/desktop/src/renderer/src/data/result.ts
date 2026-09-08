import type { ApiError, ApiErrorCode, Result } from '@trackit/shared/api'

/** A bridge call that answered { ok: false }, as the Error TanStack Query reports. */
export class ApiFailure extends Error {
  readonly code: ApiErrorCode
  constructor(error: ApiError) {
    super(error.message)
    this.name = 'ApiFailure'
    this.code = error.code
  }
}

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.data
  throw new ApiFailure(result.error)
}

/** Every queryFn and mutationFn is one of these: call the bridge, unwrap the answer. */
export const call = <T>(run: () => Promise<Result<T>>): Promise<T> => run().then(unwrap)
