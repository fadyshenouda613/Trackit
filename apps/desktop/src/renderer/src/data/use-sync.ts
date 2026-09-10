import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { ConflictResolution, Id, SyncStatus } from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

export const usePendingCounts = () =>
  useQuery({
    queryKey: keys.sync.pending,
    queryFn: () => call(() => ledger.data.sync.pendingCounts())
  })

/**
 * The sync status: read once, then kept current by main's pushes, the way
 * the update and account statuses are. When a push says the engine changed
 * local data — `revision` moved — every query is stale at once, because a
 * pull can touch any table, so everything is invalidated.
 */
export function useSyncStatus() {
  const client = useQueryClient()
  const revision = useRef<number | null>(null)
  useEffect(
    () =>
      ledger.sync.onChanged((status: SyncStatus) => {
        client.setQueryData(keys.sync.status, status)
        if (revision.current !== null && status.revision !== revision.current) {
          void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'sync' || query.queryKey[1] !== 'status' })
        }
        revision.current = status.revision
      }),
    [client]
  )
  return useQuery({
    queryKey: keys.sync.status,
    queryFn: async () => {
      const status = await call(() => ledger.sync.status())
      revision.current ??= status.revision
      return status
    },
    staleTime: Infinity
  })
}

/** Sync now. The status it answers with is written straight into the cache. */
export function useSyncNow() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => call(() => ledger.sync.now()),
    onSuccess: (status) => client.setQueryData(keys.sync.status, status),
    /* A failed sync is stated by the footer, not raised as a toast. */
    meta: { silent: true }
  })
}

export const useConflicts = () =>
  useQuery({
    queryKey: keys.sync.conflicts,
    queryFn: () => call(() => ledger.sync.conflicts())
  })

/**
 * Settling a conflict. Restoring a version is a local edit like any other,
 * so the row's own queries are stale too; the status push that follows
 * invalidates them, and the conflict list is refetched here at once.
 */
export function useResolveConflict() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: Id; resolution: ConflictResolution }) =>
      call(() => ledger.sync.resolveConflict(input.id, input.resolution)),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.sync.conflicts })
  })
}
