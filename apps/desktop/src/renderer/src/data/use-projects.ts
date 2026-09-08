import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateProjectInput,
  Id,
  Invoice,
  ProjectListFilters,
  ProjectTransition,
  UpdateProjectInput
} from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

export const useProjects = (filters?: ProjectListFilters) =>
  useQuery({
    queryKey: keys.projects.list(filters),
    queryFn: () => call(() => ledger.data.projects.list(filters))
  })

export const useProject = (id: Id | null) =>
  useQuery({
    queryKey: keys.projects.one(id ?? ''),
    queryFn: () => call(() => ledger.data.projects.get(id ?? '')),
    enabled: id !== null
  })

export const useBillableProjects = (clientId: Id | null) =>
  useQuery({
    queryKey: keys.projects.billable(clientId ?? ''),
    queryFn: () => call(() => ledger.data.projects.billable(clientId ?? '')),
    enabled: clientId !== null
  })

export const useProjectInvoice = (projectId: Id | null) =>
  useQuery({
    queryKey: keys.projects.invoice(projectId ?? ''),
    queryFn: () => call(() => ledger.data.projects.invoice(projectId ?? '')),
    enabled: projectId !== null
  })

/** Everything a project change can move: its own lists, the client's active
 *  counts and the invoices a delivered project can now (or can no longer) join. */
function useInvalidateProjects(): () => Promise<void> {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.projects.all }),
      client.invalidateQueries({ queryKey: keys.clients.all }),
      client.invalidateQueries({ queryKey: keys.invoices.all }),
      client.invalidateQueries({ queryKey: keys.sync.pending })
    ]).then(() => undefined)
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => call(() => ledger.data.projects.create(input)),
    onSuccess: invalidate
  })
}

export function useUpdateProject() {
  const invalidate = useInvalidateProjects()
  return useMutation({
    mutationFn: ({ id, patch }: { id: Id; patch: UpdateProjectInput }) =>
      call(() => ledger.data.projects.update(id, patch)),
    onSuccess: invalidate
  })
}

export function useDeleteProject() {
  const invalidate = useInvalidateProjects()
  return useMutation({
    mutationFn: (id: Id) => call(() => ledger.data.projects.delete(id)),
    onSuccess: invalidate
  })
}

export function useTransitionProject() {
  const invalidate = useInvalidateProjects()
  return useMutation({
    mutationFn: ({ id, to }: { id: Id; to: ProjectTransition }) =>
      call(() => ledger.data.projects.transition(id, to)),
    onSuccess: invalidate
  })
}

/**
 * The bridge has no "invoices for many projects" call; this fans out over the
 * same key each `useProjectInvoice` uses, so the cache is shared.
 */
export function useProjectInvoices(projectIds: Id[]): {
  data: Record<Id, Invoice | null> | undefined
  isPending: boolean
} {
  return useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: keys.projects.invoice(projectId),
      queryFn: () => call(() => ledger.data.projects.invoice(projectId))
    })),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      data: results.every((result) => result.data !== undefined)
        ? Object.fromEntries(
            projectIds.map((id, index) => [id, results[index].data as Invoice | null])
          )
        : undefined
    })
  })
}
