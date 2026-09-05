import type { JSX } from 'react'
import { InvoiceActions } from './InvoiceActions'
import { InvoiceDocument } from './InvoiceDocument'
import { InvoicePayments } from './InvoicePayments'
import type { Invoice } from './invoices-fixture'

type InvoiceDetailProps = {
  invoice: Invoice
  onOpen: (number: string) => void
  onMarkSent: () => void
  onRecordPayment: () => void
  onVoid: () => void
}

/**
 * The same split the create screen uses — the work on the left, what holds for
 * the whole thing on the right — because it is the same reading order: you read
 * down the document and glance right to see where it stands.
 *
 * The payments sit under the document rather than beside it, because they are
 * the answer to it: the bill asks for a figure, the list below says what came
 * back. Putting them in the rail would file them as metadata.
 */
export function InvoiceDetail({
  invoice,
  onOpen,
  onMarkSent,
  onRecordPayment,
  onVoid
}: InvoiceDetailProps): JSX.Element {
  return (
    <div className="invoice__body">
      <div className="invoice__work">
        <InvoiceDocument invoice={invoice} onOpen={onOpen} />
        <InvoicePayments invoice={invoice} />
      </div>

      <InvoiceActions
        invoice={invoice}
        onMarkSent={onMarkSent}
        onRecordPayment={onRecordPayment}
        onVoid={onVoid}
      />
    </div>
  )
}
