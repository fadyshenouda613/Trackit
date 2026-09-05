import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type {
  CreateTimeEntryInput,
  Id,
  StartTimerInput,
  TimeEntryListFilters,
  UpdateTimeEntryInput
} from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

/**
 * Every live entry, or the ones a filter selects. `null` means there is nothing
 * to ask about yet — the shell has a project to total only while a timer runs —
 * and then nothing is asked; `undefined` is the whole log, which the Time screen
 * wants.
 */
export const useTimeEntries = (filters?: TimeEntryListFilters | null) =>
  useQuery({
    queryKey: keys.time.list(filters ?? undefined),
    queryFn: () => call(() => ledger.data.time.list(filters ?? undefined)),
    enabled: filters !== null
  })

export const useRunningTimer = () =>
  useQuery({
    queryKey: keys.time.running,
    queryFn: () => call(() => ledger.data.time.running())
  })

export const useOrphanedTimer = () =>
  useQuery({
    queryKey: keys.time.orphan,
    queryFn: () => call(() => ledger.data.time.orphan())
  })

/** A time entry (or the clock) changing moves the log and the logged minutes
 *  and rate that fall out of it on the project it belongs to. */
function useInvalidateTime(): () => Promise<void> {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.time.all }),
      client.invalidateQueries({ queryKey: keys.projects.all }),
      client.invalidateQueries({ queryKey: keys.sync.pending })
    ]).then(() => undefined)
}

export function useCreateTimeEntry() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: (input: CreateTimeEntryInput) => call(() => ledger.data.time.create(input)),
    onSuccess: invalidate
  })
}

export function useUpdateTimeEntry() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: ({ id, patch }: { id: Id; patch: UpdateTimeEntryInput }) =>
      call(() => ledger.data.time.update(id, patch)),
    onSuccess: invalidate
  })
}

export function useDeleteTimeEntry() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: (id: Id) => call(() => ledger.data.time.delete(id)),
    onSuccess: invalidate
  })
}

export function useStartTimer() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: (input: StartTimerInput) => call(() => ledger.data.time.start(input)),
    onSuccess: invalidate
  })
}

export function useStopTimer() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: () => call(() => ledger.data.time.stop()),
    onSuccess: invalidate
  })
}

/** The tray and the shortcut change the clock behind the renderer's back; this is how it hears. */
export function useTimerChangedFromMain(): void {
  const client = useQueryClient()
  useEffect(
    () =>
      ledger.timer.onChanged(() => {
        void client.invalidateQueries({ queryKey: keys.time.all })
        void client.invalidateQueries({ queryKey: keys.projects.all })
      }),
    [client]
  )
}
