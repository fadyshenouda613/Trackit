import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Id,
  InvoiceListFilters,
  NewInvoiceInput,
  UpdateInvoiceInput,
  VoidInvoiceInput
} from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

export const useInvoices = (filters?: InvoiceListFilters) =>
  useQuery({
    queryKey: keys.invoices.list(filters),
    queryFn: () => call(() => ledger.data.invoices.list(filters))
  })

export const useInvoice = (id: Id | null) =>
  useQuery({
    queryKey: keys.invoices.one(id ?? ''),
    queryFn: () => call(() => ledger.data.invoices.get(id ?? '')),
    enabled: id !== null
  })

export const useInvoiceLines = (id: Id | null) =>
  useQuery({
    queryKey: keys.invoices.lines(id ?? ''),
    queryFn: () => call(() => ledger.data.invoices.lines(id ?? '')),
    enabled: id !== null
  })

/** An invoice change moves its own lists and the status (invoiced/paid) a
 *  project's tables show. */
function useInvalidateInvoices(): () => Promise<void> {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.invoices.all }),
      client.invalidateQueries({ queryKey: keys.projects.all }),
      client.invalidateQueries({ queryKey: keys.sync.pending })
    ]).then(() => undefined)
}

export function useCreateInvoice() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (input: NewInvoiceInput) => call(() => ledger.data.invoices.create(input)),
    onSuccess: invalidate
  })
}

export function useSendInvoice() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (id: Id) => call(() => ledger.data.invoices.send(id)),
    onSuccess: invalidate
  })
}

export function useVoidInvoice() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: VoidInvoiceInput }) =>
      call(() => ledger.data.invoices.void(id, input)),
    onSuccess: invalidate
  })
}

export function useUpdateInvoice() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: ({ id, patch }: { id: Id; patch: UpdateInvoiceInput }) =>
      call(() => ledger.data.invoices.update(id, patch)),
    onSuccess: invalidate
  })
}

export function useDeleteInvoice() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (id: Id) => call(() => ledger.data.invoices.delete(id)),
    onSuccess: invalidate
  })
}

/**
 * The PDF. Main syncs first and stamps the invoice after, so the invoice
 * and everything a sync may have touched are stale once it answers; the
 * sync status push covers the rest, and the invoice's own queries are
 * refetched here at once.
 */
export function useGeneratePdf() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (id: Id) => call(() => ledger.pdf.generate(id)),
    onSuccess: invalidate
  })
}

/** Show the cached file in the file manager. A refusal — no file here — is a toast. */
export const useRevealPdf = () =>
  useMutation({ mutationFn: (id: Id) => call(() => ledger.pdf.reveal(id)) })

/** The save dialog over the cached file. Cancelling answers null and is not an error. */
export const useSavePdfAs = () =>
  useMutation({ mutationFn: (id: Id) => call(() => ledger.pdf.saveAs(id)) })
