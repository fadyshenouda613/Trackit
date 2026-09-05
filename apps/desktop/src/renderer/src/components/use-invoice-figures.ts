import { useMemo } from 'react'
import type { Invoice } from '@trackit/shared'
import { usePaymentsByInvoice } from '../data/use-payments'
import { todayIso } from './local-dates'
import { summarise, type Summary } from './invoices-data'
import type { PaymentsByInvoice } from './client-rows'

/** The composition three places repeat (App's sidebar badge + top bars, InvoicesScreen, MetricCards). */
export function useInvoiceFigures(invoices: Invoice[] | undefined): {
  payments: PaymentsByInvoice
  summary: Summary
  isPending: boolean
} {
  const rows = invoices ?? []
  const batch = usePaymentsByInvoice(rows.map((i) => i.id))
  const payments = batch.data ?? {}
  const today = todayIso()
  const summary = useMemo(() => summarise(rows, payments, today), [rows, payments, today])
  return { payments, summary, isPending: batch.isPending }
}
