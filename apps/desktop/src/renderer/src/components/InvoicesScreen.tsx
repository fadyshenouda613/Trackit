import { useMemo, useState, type JSX } from 'react'
import { InvoicesTable } from './InvoicesTable'
import { TableSkeleton } from './TableSkeleton'
import { ALL, InvoicesToolbar } from './InvoicesToolbar'
import {
  formatCents,
  invoiceStatusSchema,
  type Id,
  type InvoiceListFilters,
  type InvoiceSort,
  type InvoiceStatus
} from '@trackit/shared'
import { EmptyState } from './EmptyState'
import { statusStyles } from './status'
import { todayIso } from './local-dates'
import { useClients } from '../data/use-clients'
import { useInvoices } from '../data/use-invoices'
import { useInvoiceFigures } from './use-invoice-figures'

/* The five an invoice can be, in the order it passes through them. */
const statusOptions = [ALL, ...invoiceStatusSchema.options.map((status) => statusStyles[status].label)]

/** The label the Status dropdown shows, back to the key the store filters on. */
const statusKeyOf = (label: string): InvoiceStatus | undefined =>
  invoiceStatusSchema.options.find((status) => statusStyles[status].label === label)

const SORTS: Record<string, InvoiceSort> = {
  Issued: 'issued',
  Due: 'due',
  Total: 'total',
  Client: 'client'
}

type InvoicesScreenProps = {
  onOpen: (id: Id) => void
  onNewInvoice: () => void
  /** Rows not in yet. The figures above stay, because they are already known. */
  loading?: boolean
}

/**
 * The list.
 *
 * One figure above the table and one row beneath it, both computed from the
 * rows actually showing. That is the whole reason the filters are live: an
 * outstanding total that does not move when you ask "just Ortega, then" is a
 * decoration, and this screen exists to answer exactly that question.
 *
 * The narrowing and the ordering are the store's — the same query the register
 * itself is kept in — so the rows arrive filtered and sorted rather than being
 * re-sorted here into an order the database could disagree with.
 */
export function InvoicesScreen({
  onOpen,
  onNewInvoice,
  loading = false
}: InvoicesScreenProps): JSX.Element {
  const [status, setStatus] = useState(ALL)
  const [client, setClient] = useState(ALL)
  const [sort, setSort] = useState('Issued')

  const clients = useClients()
  /* Unfiltered: the client dropdown offers whoever has an invoice, whatever
     the list is currently narrowed to, and an empty register is an empty
     register rather than a filter that found nothing. */
  const register = useInvoices()

  const clientList = clients.data ?? []
  const clientId =
    client === ALL ? undefined : clientList.find((entry) => entry.company === client)?.id

  const filters = useMemo<InvoiceListFilters>(
    () => ({
      status: status === ALL ? undefined : statusKeyOf(status),
      clientId,
      sort: SORTS[sort]
    }),
    [status, clientId, sort]
  )

  const invoices = useInvoices(filters)
  const rows = useMemo(() => invoices.data ?? [], [invoices.data])
  const { payments, summary, isPending } = useInvoiceFigures(rows)
  const today = todayIso()

  /** Only clients who actually have an invoice — a filter that finds nothing is noise. */
  const clientOptions = useMemo(() => {
    const billed = new Set((register.data ?? []).map((invoice) => invoice.clientId))
    return [
      ALL,
      ...clientList
        .filter((entry) => billed.has(entry.id) && entry.company)
        .map((entry) => entry.company)
        .sort((a, b) => a.localeCompare(b))
    ]
  }, [register.data, clientList])

  const narrowed = status !== ALL || client !== ALL
  const pending = loading || invoices.isPending || register.isPending || clients.isPending || isPending
  /* Only a read that came back may say the register is empty. A refused one has
     already said what happened, as a toast, and drawing "No invoices yet" over
     it would be a second and wrong answer. */
  const emptyRegister = !pending && register.isSuccess && (register.data ?? []).length === 0

  return (
    <>
      <InvoicesToolbar
        status={status}
        onStatus={setStatus}
        statuses={statusOptions}
        client={client}
        onClient={setClient}
        clients={clientOptions}
        sort={sort}
        onSort={setSort}
      />

      <div className="main__content">
        <section className="panel inv-figure">
          <div className="inv-figure__text">
            <span className="t-overline inv-figure__label">Outstanding</span>
            <span className="inv-figure__value">{formatCents(summary.outstanding)}</span>
          </div>

          <div className="spacer" />

          <div className="inv-figure__facts">
            <span className="inv-figure__fact">
              {summary.openCount} {summary.openCount === 1 ? 'invoice' : 'invoices'} unpaid
            </span>
            <span className="inv-figure__sep">·</span>
            {summary.overdueCount > 0 ? (
              <span className="inv-figure__fact inv-figure__fact--late">
                {formatCents(summary.overdueAmount)} overdue on {summary.overdueCount}
              </span>
            ) : (
              <span className="inv-figure__fact">Nothing overdue</span>
            )}
            {narrowed && (
              <>
                <span className="inv-figure__sep">·</span>
                <span className="inv-figure__fact inv-figure__fact--quiet">Filtered</span>
              </>
            )}
          </div>
        </section>

        {pending ? (
          <TableSkeleton block="invoices" />
        ) : emptyRegister ? (
          <div className="panel invoices">
            <EmptyState
              variant="panel"
              title="No invoices yet"
              body="Deliver a project, then raise an invoice from it. Drafts sit here until you send them."
              action={{ label: 'New invoice', onClick: onNewInvoice }}
            />
          </div>
        ) : invoices.isSuccess ? (
          <InvoicesTable
            rows={rows}
            clients={clientList}
            payments={payments}
            today={today}
            onOpen={onOpen}
          />
        ) : null}
      </div>
    </>
  )
}
