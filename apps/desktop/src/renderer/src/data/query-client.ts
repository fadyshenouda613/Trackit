import { MutationCache, QueryClient } from '@tanstack/react-query'
import { ApiFailure } from './result'

/*
 * One client for the renderer. The store is local SQLite over IPC: there is
 * no network to retry against and nothing goes stale behind our back except
 * through our own mutations (and the tray, which tells us). So: no retries,
 * no refetch on focus, and invalidation is the only way data moves.
 *
 * A mutation that fails is reported once, here, as a toast — a screen never
 * has to remember to.
 */
export function createQueryClient(onMutationError: (error: ApiFailure) => void): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 },
      mutations: { retry: false }
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error instanceof ApiFailure) onMutationError(error)
        else onMutationError(new ApiFailure({ code: 'internal', message: String(error) }))
      }
    })
  })
}
