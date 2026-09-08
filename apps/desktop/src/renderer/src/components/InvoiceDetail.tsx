import type { JSX } from 'react'
import { paidCents, type Id } from '@trackit/shared'
import { EmptyState } from './EmptyState'
import { InvoiceActions } from './InvoiceActions'
import { InvoiceDocument } from './InvoiceDocument'
import { InvoicePayments } from './InvoicePayments'
import { groupLines } from './invoices-data'
import { todayIso } from './local-dates'
import { TableSkeleton } from './TableSkeleton'
import { useClient } from '../data/use-clients'
import {
  useDeleteInvoice,
  useInvoice,
  useInvoiceLines,
  useSendInvoice,
  useVoidInvoice
} from '../data/use-invoices'
import { usePayments } from '../data/use-payments'
import { useProjects } from '../data/use-projects'
import { useSettings } from '../data/use-settings'

type InvoiceDetailProps = {
  invoiceId: Id
  /** Opens the invoice a voided one was reissued as. */
  onOpen: (id: Id) => void
  onRecordPayment: () => void
  onBack: () => void
  /** Rows not in yet. */
  loading?: boolean
}

/**
 * The same split the create screen uses — the work on the left, what holds for
 * the whole thing on the right — because it is the same reading order: you read
 * down the document and glance right to see where it stands.
 *
 * The payments sit under the document rather than beside it, because they are
 * the answer to it: the bill asks for a figure, the list below says what came
 * back. Putting them in the rail would file them as metadata.
 *
 * This screen is the one that owns the record: the document, the payments and
 * the rail are all views of the same invoice, so it is read once here and
 * handed down rather than fetched three times.
 */
export function InvoiceDetail({
  invoiceId,
  onOpen,
  onRecordPayment,
  onBack,
  loading = false
}: InvoiceDetailProps): JSX.Element {
  const invoice = useInvoice(invoiceId)
  const lines = useInvoiceLines(invoiceId)
  const payments = usePayments(invoiceId)
  const record = invoice.data ?? null
  const client = useClient(record?.clientId ?? null)
  /* Only for the names over the line groups: a line snapshots its label, but
     the project it was ticked from is what the group is called. */
  const projects = useProjects({ clientId: record?.clientId })
  const settings = useSettings()
  /* The invoice a voided one was reissued as, so the banner can link to it. */
  const replacement = useInvoice(record?.replacedByInvoiceId ?? null)

  const send = useSendInvoice()
  const voidIt = useVoidInvoice()
  const deleteIt = useDeleteInvoice()

  const today = todayIso()

  /* The whole first paint or none of it: the document, the payments and the
     rail are three readings of one record, and a sheet with its lines still in
     flight would state a total nothing under it adds up to. */
  if (
    loading ||
    invoice.data === undefined ||
    settings.data === undefined ||
    lines.isPending ||
    payments.isPending
  ) {
    return (
      <div className="invoice__body">
        <div className="invoice__work">
          <TableSkeleton block="invoices" rows={5} />
        </div>
      </div>
    )
  }

  if (invoice.data === null) {
    return (
      <EmptyState
        variant="screen"
        title="That invoice is gone"
        body="It may have been deleted, or the link that brought you here is stale."
        action={{ label: 'Back to invoices', onClick: onBack }}
      />
    )
  }

  const current = invoice.data
  const paid = paidCents(payments.data ?? [])
  const replacedBy = replacement.data
    ? { id: replacement.data.id, number: replacement.data.number }
    : null

  return (
    <div className="invoice__body">
      <div className="invoice__work">
        <InvoiceDocument
          invoice={current}
          lines={groupLines(lines.data ?? [], projects.data ?? [])}
          client={client.data ?? null}
          settings={settings.data}
          replacedBy={replacedBy}
          onOpen={onOpen}
        />
        <InvoicePayments invoice={current} payments={payments.data ?? []} />
      </div>

      <InvoiceActions
        invoice={current}
        paid={paid}
        today={today}
        onMarkSent={() => send.mutate(current.id)}
        onRecordPayment={onRecordPayment}
        onVoid={() =>
          voidIt.mutate({
            id: current.id,
            input: { reason: 'Cancelled before payment', replacedByInvoiceId: null }
          })
        }
        /* A draft was never issued, so there is nothing to void: it goes, and
           the screen goes with it — there is no record left to be on. */
        onDelete={() => deleteIt.mutate(current.id, { onSuccess: onBack })}
        pending={voidIt.isPending || deleteIt.isPending}
      />
    </div>
  )
}
