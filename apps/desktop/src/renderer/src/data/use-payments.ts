import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreatePaymentInput, Id, Payment } from '@trackit/shared/schemas'
import { ledger } from '../bridge'
import { keys } from './keys'
import { call } from './result'

export const usePayments = (invoiceId: Id | null) =>
  useQuery({
    queryKey: keys.payments.list(invoiceId ?? ''),
    queryFn: () => call(() => ledger.data.payments.list(invoiceId ?? '')),
    enabled: invoiceId !== null
  })

/** A payment moves its own invoice's list, the invoice it settles and the
 *  project the invoice bills. */
function useInvalidatePayments(): () => Promise<void> {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.payments.all }),
      client.invalidateQueries({ queryKey: keys.invoices.all }),
      client.invalidateQueries({ queryKey: keys.projects.all }),
      client.invalidateQueries({ queryKey: keys.sync.pending })
    ]).then(() => undefined)
}

export function useRecordPayment() {
  const invalidate = useInvalidatePayments()
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => call(() => ledger.data.payments.create(input)),
    onSuccess: invalidate
  })
}

export function useDeletePayment() {
  const invalidate = useInvalidatePayments()
  return useMutation({
    mutationFn: (id: Id) => call(() => ledger.data.payments.delete(id)),
    onSuccess: invalidate
  })
}

/**
 * The bridge has no "payments for many invoices" call; this fans out over the
 * same key `usePayments` uses, so the cache is shared.
 */
export function usePaymentsByInvoice(invoiceIds: Id[]): {
  data: Record<Id, Payment[]> | undefined
  isPending: boolean
} {
  return useQueries({
    queries: invoiceIds.map((invoiceId) => ({
      queryKey: keys.payments.list(invoiceId),
      queryFn: () => call(() => ledger.data.payments.list(invoiceId))
    })),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      data: results.every((result) => result.data !== undefined)
        ? Object.fromEntries(invoiceIds.map((id, index) => [id, results[index].data as Payment[]]))
        : undefined
    })
  })
}
