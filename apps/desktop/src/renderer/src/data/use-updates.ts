import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { UpdateStatus } from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

/**
 * The update status: read once, then kept current by main's pushes. Every
 * move arrives as a value over the bridge and is written straight into the
 * cache — there is nothing to refetch, main already sent the answer.
 */
export function useUpdateStatus() {
  const client = useQueryClient()
  useEffect(
    () => ledger.updates.onChanged((status: UpdateStatus) => client.setQueryData(keys.updates, status)),
    [client]
  )
  return useQuery({
    queryKey: keys.updates,
    queryFn: () => call(() => ledger.updates.status()),
    staleTime: Infinity
  })
}

export function useInstallUpdate() {
  return useMutation({ mutationFn: () => call(() => ledger.updates.install()) })
}
