import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiFailure } from './result'

/** How long the same message stays silent after it has been reported once. */
const REPEAT_MS = 5_000

/*
 * One client for the renderer. The store is local SQLite over IPC: there is
 * no network to retry against and nothing goes stale behind our back except
 * through our own mutations (and the tray, which tells us). So: no retries,
 * no refetch on focus, and invalidation is the only way data moves.
 *
 * A write that fails is reported once, here, as a toast — a screen never has
 * to remember to. So is a read: a query that the store refuses used to fail
 * silently and leave a screen looking merely empty, which is the one thing an
 * error must never look like.
 *
 * Reads are de-duplicated where writes are not, because one broken read is
 * usually several: a screen mounts a dozen queries against the same store, and
 * a dozen identical toasts is a stack that hides its own first line.
 *
 * A mutation with `meta: { silent: true }` is left to its caller: the
 * sign-in card states a refusal beneath the field, in its own words, and a
 * toast on top of that would say the same thing twice.
 */
export function createQueryClient(onError: (error: ApiFailure) => void): QueryClient {
  const asFailure = (error: unknown): ApiFailure =>
    error instanceof ApiFailure ? error : new ApiFailure({ code: 'internal', message: String(error) })

  let lastMessage = ''
  let lastAt = 0

  const reportOnce = (error: unknown): void => {
    const failure = asFailure(error)
    const at = Date.now()
    if (failure.message === lastMessage && at - lastAt < REPEAT_MS) return
    lastMessage = failure.message
    lastAt = at
    onError(failure)
  }

  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 },
      mutations: { retry: false }
    },
    queryCache: new QueryCache({ onError: reportOnce }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation?.meta?.silent === true) return
        onError(asFailure(error))
      }
    })
  })
}
