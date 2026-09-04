import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateNoteInput, Id, NoteListFilters, UpdateNoteInput } from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

export const useNotes = (filters: NoteListFilters) =>
  useQuery({
    queryKey: keys.notes.list(filters),
    queryFn: () => call(() => ledger.data.notes.list(filters))
  })

function useInvalidateNotes(): () => Promise<void> {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.notes.all }),
      client.invalidateQueries({ queryKey: keys.sync.pending })
    ]).then(() => undefined)
}

export function useCreateNote() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (input: CreateNoteInput) => call(() => ledger.data.notes.create(input)),
    onSuccess: invalidate
  })
}

export function useUpdateNote() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: ({ id, patch }: { id: Id; patch: UpdateNoteInput }) =>
      call(() => ledger.data.notes.update(id, patch)),
    onSuccess: invalidate
  })
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (id: Id) => call(() => ledger.data.notes.delete(id)),
    onSuccess: invalidate
  })
}
