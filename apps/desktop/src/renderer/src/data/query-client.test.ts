import { describe, expect, it, vi } from 'vitest'
import type { Query } from '@tanstack/react-query'
import { createQueryClient } from './query-client'
import { ApiFailure } from './result'

/*
 * The read path only. A screen mounts a dozen queries against one store, so a
 * store that has stopped answering fails a dozen of them at once — and a dozen
 * identical toasts is a stack that hides its own first line.
 */

/* The cache hands its onError the Query the read belongs to. Nothing under
   test reads it, and building a real one would mean a real bridge. */
const noQuery = {} as Query<unknown, unknown>

const report = (client: ReturnType<typeof createQueryClient>, message: string): void => {
  client.getQueryCache().config.onError?.(new ApiFailure({ code: 'internal', message }), noQuery)
}

describe('createQueryClient', () => {
  it('reports a failed read once, however many queries fail with it', () => {
    const onError = vi.fn()
    const client = createQueryClient(onError)

    report(client, 'The store is not answering')
    report(client, 'The store is not answering')
    report(client, 'The store is not answering')

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].message).toBe('The store is not answering')
  })

  it('still reports a different failure straight away', () => {
    const onError = vi.fn()
    const client = createQueryClient(onError)

    report(client, 'The store is not answering')
    report(client, 'That client is gone')

    expect(onError).toHaveBeenCalledTimes(2)
    expect(onError.mock.calls[1][0].message).toBe('That client is gone')
  })

  it('reports the same message again once the window has passed', () => {
    vi.useFakeTimers()
    try {
      const onError = vi.fn()
      const client = createQueryClient(onError)

      report(client, 'The store is not answering')
      vi.advanceTimersByTime(4_000)
      report(client, 'The store is not answering')
      expect(onError).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1_001)
      report(client, 'The store is not answering')
      expect(onError).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves writes alone: a failed write is reported every time it fails', () => {
    const onError = vi.fn()
    const client = createQueryClient(onError)
    const failure = new ApiFailure({ code: 'validation', message: 'A timer is already running' })

    /* The mutation cache hands its onError the error, the variables, the
       context and the mutation; only the first is read here. */
    const onMutationError = client.getMutationCache().config.onError as (error: unknown) => void
    onMutationError(failure)
    onMutationError(failure)

    expect(onError).toHaveBeenCalledTimes(2)
  })
})
