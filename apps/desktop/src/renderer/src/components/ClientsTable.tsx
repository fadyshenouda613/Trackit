import { useMemo, type JSX } from 'react'
import type { Id } from '@trackit/shared'
import { Avatar } from './Avatar'
import { byOutstanding, clientRow, clientTotals } from './client-rows'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { todayIso } from './local-dates'
import { Pill } from './Pill'
import { TableSkeleton } from './TableSkeleton'
import { useClients } from '../data/use-clients'
import { useInvoices } from '../data/use-invoices'
import { usePaymentsByInvoice } from '../data/use-payments'
import { useProjects } from '../data/use-projects'

type ClientsTableProps = {
  selectedId?: Id
  onOpen: (id: Id) => void
  onNewClient?: () => void
  /** Rows not in yet. */
  loading?: boolean
}

export function ClientsTable({
  selectedId,
  onOpen,
  onNewClient,
  loading = false
}: ClientsTableProps): JSX.Element {
  const clients = useClients()
  const projects = useProjects()
  const invoices = useInvoices()
  const invoiceIds = useMemo(() => (invoices.data ?? []).map((i) => i.id), [invoices.data])
  const payments = usePaymentsByInvoice(invoiceIds)
  const today = todayIso()

  const rows = useMemo(
    () =>
      (clients.data ?? [])
        .map((c) =>
          clientRow(c, projects.data ?? [], invoices.data ?? [], payments.data ?? {}, today)
        )
        .sort(byOutstanding),
    [clients.data, projects.data, invoices.data, payments.data, today]
  )
  const totals = clientTotals(rows)

  const pending =
    loading || clients.isPending || projects.isPending || invoices.isPending || payments.isPending

  if (pending) return <TableSkeleton block="clients" />

  return (
    <div className="panel clients">
      <div className="clients__header t-overline">
        <span>Name</span>
        <span>Company</span>
        <span className="align-right">Active projects</span>
        <span className="align-right">Lifetime billed</span>
        <span className="align-right">Outstanding</span>
        <span />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          variant="panel"
          title="No clients yet"
          body="Add whoever is paying you; projects, hours and invoices all hang off a client."
          action={{ label: 'New client', onClick: onNewClient }}
        />
      ) : (
        rows.map((row) => {
          const selected = row.id === selectedId
          const zero = row.outstandingCents === 0

          return (
            <div
              key={row.id}
              className={selected ? 'clients__row clients__row--selected' : 'clients__row'}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(row.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(row.id)
                }
              }}
            >
              <div className="clients__name">
                <Avatar initials={row.initials} tone={selected ? 'accent' : 'neutral'} />
                <span className="clients__label truncate">{row.name}</span>
              </div>

              <span className="clients__company truncate">{row.company}</span>

              <span
                className={
                  row.activeProjects === '0'
                    ? 'align-right clients__muted'
                    : 'align-right clients__company'
                }
              >
                {row.activeProjects}
              </span>

              <span className="align-right">{row.lifetime}</span>

              {row.late ? (
                <div className="clients__outstanding">
                  <Pill tone="negative">{row.late}</Pill>
                  <span className="clients__overdue">{row.outstanding}</span>
                </div>
              ) : (
                <span className={zero ? 'align-right clients__muted' : 'align-right'}>
                  {row.outstanding}
                </span>
              )}

              <Icon
                name="chevron"
                size={12}
                className={selected ? 'clients__chevron--on' : 'clients__chevron'}
              />
            </div>
          )
        })
      )}

      <div className="clients__row clients__totals">
        <span className="clients__totals-label">{totals.count} clients</span>
        <span />
        <span className="align-right clients__totals-label">{totals.active}</span>
        <span className="align-right clients__totals-value">{totals.lifetime}</span>
        <span className="align-right clients__totals-value">{totals.outstanding}</span>
        <span />
      </div>
    </div>
  )
}
