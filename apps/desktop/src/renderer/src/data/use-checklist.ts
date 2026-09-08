import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query'
import type {
  ChecklistItem,
  Id,
  NewChecklistItemInput,
  UpdateChecklistItemInput
} from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

/** Null when there is no project to ask about — the shell has one only while a
 *  timer runs — and then nothing is asked, the way useClient and useProject do it. */
export const useChecklist = (projectId: Id | null) =>
  useQuery({
    queryKey: keys.checklist.list(projectId ?? ''),
    queryFn: () => call(() => ledger.data.checklist.list(projectId ?? '')),
    enabled: projectId !== null
  })

/** A checklist change moves its own project's list and that project's progress
 *  in the tables that show it. */
function invalidateChecklist(client: QueryClient, projectId: Id): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: keys.checklist.list(projectId) }),
    client.invalidateQueries({ queryKey: keys.projects.all }),
    client.invalidateQueries({ queryKey: keys.sync.pending })
  ]).then(() => undefined)
}

export function useCreateChecklistItem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NewChecklistItemInput) => call(() => ledger.data.checklist.create(input)),
    onSuccess: (_data, variables) => invalidateChecklist(client, variables.projectId)
  })
}

export function useUpdateChecklistItem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch
    }: {
      id: Id
      patch: UpdateChecklistItemInput
      /** Not sent to the store — only used to invalidate the right list. */
      projectId: Id
    }) => call(() => ledger.data.checklist.update(id, patch)),
    onSuccess: (_data, variables) => invalidateChecklist(client, variables.projectId)
  })
}

export function useDeleteChecklistItem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: Id; projectId: Id }) =>
      call(() => ledger.data.checklist.delete(id)),
    onSuccess: (_data, variables) => invalidateChecklist(client, variables.projectId)
  })
}

/**
 * The bridge has no "checklists for many projects" call; this fans out over
 * the same key `useChecklist` uses, so the cache is shared.
 */
export function useChecklists(projectIds: Id[]): {
  data: Record<Id, ChecklistItem[]> | undefined
  isPending: boolean
} {
  return useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: keys.checklist.list(projectId),
      queryFn: () => call(() => ledger.data.checklist.list(projectId))
    })),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      data: results.every((result) => result.data !== undefined)
        ? Object.fromEntries(
            projectIds.map((id, index) => [id, results[index].data as ChecklistItem[]])
          )
        : undefined
    })
  })
}
