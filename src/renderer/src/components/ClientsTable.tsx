import type { JSX } from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Pill } from './Pill'

type ClientRow = {
  id: string
  initials: string
  name: string
  company: string
  activeProjects: string
  lifetime: string
  outstanding: string
  /** Overdue marker beside the outstanding figure. */
  late?: string
  /** Only the client the artboard specifies a detail screen for is openable. */
  openable?: boolean
}

export const clientRows: ClientRow[] = [
  {
    id: 'sable',
    initials: 'TS',
    name: 'Tom Sable',
    company: 'Sable Studio',
    activeProjects: '1',
    lifetime: '$31,900.00',
    outstanding: '$9,000.00'
  },
  {
    id: 'northwind',
    initials: 'PR',
    name: 'Priya Raghunathan',
    company: 'Northwind Studio',
    activeProjects: '2',
    lifetime: '$48,200.00',
    outstanding: '$6,500.00',
    openable: true
  },
  {
    id: 'kestrel',
    initials: 'AK',
    name: 'Ana Kestrel',
    company: 'Kestrel Press',
    activeProjects: '1',
    lifetime: '$9,600.00',
    outstanding: '$3,200.00'
  },
  {
    id: 'ortega',
    initials: 'EO',
    name: 'Elena Ortega',
    company: 'Ortega & Co',
    activeProjects: '1',
    lifetime: '$12,400.00',
    outstanding: '$2,100.00',
    late: '24d late'
  },
  {
    id: 'halcyon',
    initials: 'DH',
    name: 'Devi Halcyon',
    company: 'Halcyon Labs',
    activeProjects: '0',
    lifetime: '$4,300.00',
    outstanding: '$860.00',
    late: '6d late'
  },
  {
    id: 'marlow',
    initials: 'ML',
    name: 'Marcus Lidell',
    company: 'Marlow Foods',
    activeProjects: '1',
    lifetime: '$22,000.00',
    outstanding: '$0.00'
  },
  {
    id: 'brandt',
    initials: 'JB',
    name: 'Jonas Brandt',
    company: 'Brandt & Vale',
    activeProjects: '0',
    lifetime: '$18,750.00',
    outstanding: '$0.00'
  },
  {
    id: 'meridian',
    initials: 'CN',
    name: 'Clare Nkemelu',
    company: 'Meridian Coffee',
    activeProjects: '0',
    lifetime: '$6,900.00',
    outstanding: '$0.00'
  }
]

type ClientsTableProps = {
  selectedId?: string
  onOpen: (id: string) => void
}

export function ClientsTable({ selectedId, onOpen }: ClientsTableProps): JSX.Element {
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

      {clientRows.map((row) => {
        const selected = row.id === selectedId
        const zero = row.outstanding === '$0.00'

        return (
          <div
            key={row.id}
            className={selected ? 'clients__row clients__row--selected' : 'clients__row'}
            role={row.openable ? 'button' : undefined}
            tabIndex={row.openable ? 0 : undefined}
            onClick={row.openable ? () => onOpen(row.id) : undefined}
            onKeyDown={
              row.openable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpen(row.id)
                    }
                  }
                : undefined
            }
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
      })}

      <div className="clients__row clients__totals">
        <span className="clients__totals-label">8 clients</span>
        <span />
        <span className="align-right clients__totals-label">6</span>
        <span className="align-right clients__totals-value">$154,050.00</span>
        <span className="align-right clients__totals-value">$21,660.00</span>
        <span />
      </div>
    </div>
  )
}
