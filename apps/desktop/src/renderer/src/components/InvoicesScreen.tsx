import { useMemo, useState, type JSX } from 'react'
import { InvoicesTable } from './InvoicesTable'
import { TableSkeleton } from './TableSkeleton'
import { ALL, InvoicesToolbar } from './InvoicesToolbar'
import { money } from './money'
import { statusStyles } from './status'
import {
  clientOf,
  dueOf,
  invoices,
  statusOf,
  summarise,
  totalOf,
  type Invoice
} from './invoices-data'

/* The five an invoice can be, in the order it passes through them. */
const statusOptions = [
  ALL,
  statusStyles.draft.label,
  statusStyles.sent.label,
  statusStyles.partial.label,
  statusStyles.paid.label,
  statusStyles.void.label
]

/** Only clients who actually have an invoice — a filter that finds nothing is noise. */
const clientOptions = [
  ALL,
  ...Array.from(
    new Set(invoices.map((invoice) => clientOf(invoice)?.company).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b))
]

/** Drafts sort to the top of a date column: they are the newest thing you touched. */
const NEWEST = '9999-12-31'

function sorted(rows: Invoice[], sort: string): Invoice[] {
  const copy = [...rows]
  if (sort === 'Due') {
    return copy.sort((a, b) => (dueOf(b) ?? NEWEST).localeCompare(dueOf(a) ?? NEWEST))
  }
  if (sort === 'Total') return copy.sort((a, b) => totalOf(b) - totalOf(a))
  if (sort === 'Client') {
    return copy.sort((a, b) =>
      (clientOf(a)?.company ?? '').localeCompare(clientOf(b)?.company ?? '')
    )
  }
  return copy.sort((a, b) => (b.issued ?? NEWEST).localeCompare(a.issued ?? NEWEST))
}

type InvoicesScreenProps = {
  /** The live register, so a payment recorded on a detail moves this list too. */
  register: Invoice[]
  onOpen: (number: string) => void
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
 */
export function InvoicesScreen({
  register,
  onOpen,
  loading = false
}: InvoicesScreenProps): JSX.Element {
  const [status, setStatus] = useState(ALL)
  const [client, setClient] = useState(ALL)
  const [sort, setSort] = useState('Issued')

  const rows = useMemo(() => {
    const filtered = register.filter((invoice) => {
      if (status !== ALL && statusStyles[statusOf(invoice)].label !== status) return false
      if (client !== ALL && clientOf(invoice)?.company !== client) return false
      return true
    })
    return sorted(filtered, sort)
  }, [register, status, client, sort])

  const figures = summarise(rows)
  const narrowed = status !== ALL || client !== ALL

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
            <span className="inv-figure__value">{money(figures.outstanding)}</span>
          </div>

          <div className="spacer" />

          <div className="inv-figure__facts">
            <span className="inv-figure__fact">
              {figures.openCount} {figures.openCount === 1 ? 'invoice' : 'invoices'} unpaid
            </span>
            <span className="inv-figure__sep">·</span>
            {figures.overdueCount > 0 ? (
              <span className="inv-figure__fact inv-figure__fact--late">
                {money(figures.overdueAmount)} overdue on {figures.overdueCount}
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

        {loading ? <TableSkeleton block="invoices" /> : <InvoicesTable rows={rows} onOpen={onOpen} />}
      </div>
    </>
  )
}
