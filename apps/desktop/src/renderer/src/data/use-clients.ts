import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ClientListFilters,
  CreateClientInput,
  Id,
  UpdateClientInput
} from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

export const useClients = (filters?: ClientListFilters) =>
  useQuery({
    queryKey: keys.clients.list(filters),
    queryFn: () => call(() => ledger.data.clients.list(filters))
  })

export const useClient = (id: Id | null) =>
  useQuery({
    queryKey: keys.clients.one(id ?? ''),
    queryFn: () => call(() => ledger.data.clients.get(id ?? '')),
    enabled: id !== null
  })

/** Everything a client change can move: its own lists, and the counts beside them. */
function useInvalidateClients(): () => Promise<void> {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.clients.all }),
      client.invalidateQueries({ queryKey: keys.sync.pending })
    ]).then(() => undefined)
}

export function useCreateClient() {
  const invalidate = useInvalidateClients()
  return useMutation({
    mutationFn: (input: CreateClientInput) => call(() => ledger.data.clients.create(input)),
    onSuccess: invalidate
  })
}

export function useUpdateClient() {
  const invalidate = useInvalidateClients()
  return useMutation({
    mutationFn: ({ id, patch }: { id: Id; patch: UpdateClientInput }) =>
      call(() => ledger.data.clients.update(id, patch)),
    onSuccess: invalidate
  })
}

export function useDeleteClient() {
  const invalidate = useInvalidateClients()
  return useMutation({
    mutationFn: (id: Id) => call(() => ledger.data.clients.delete(id)),
    onSuccess: invalidate
  })
}
