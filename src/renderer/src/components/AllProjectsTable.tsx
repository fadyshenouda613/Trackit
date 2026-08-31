import type { JSX } from 'react'
import { Meter } from './Meter'
import { toneVar, type TextTone } from './tone'
import { StatusPill } from './StatusPill'
import type { Status } from './status'

type Row = {
  name: string
  client: string
  price: string
  status: Status
  checklist: string
  /** Draft has agreed nothing, so its rails render empty rather than at 0%. */
  checklistPct: number | null
  hours: string
  budgetPct: number | null
  budgetLabel: string
  budgetTone: TextTone
  budgetLabelTone: TextTone
  rate: string
  rateTone: TextTone
  delivered: string
  /** The project the running timer belongs to. */
  running?: boolean
}

const rows: Row[] = [
  {
    name: 'Brand refresh',
    client: 'Northwind Studio',
    price: '$6,500.00',
    status: 'active',
    checklist: '8/14',
    checklistPct: 57,
    hours: '28h 15m',
    budgetPct: 88,
    budgetLabel: '88%',
    budgetTone: 'warning',
    budgetLabelTone: 'warning',
    rate: '$230.09/hr',
    rateTone: 'positive',
    delivered: '—',
    running: true
  },
  {
    name: 'Site build',
    client: 'Sable Studio',
    price: '$9,000.00',
    status: 'active',
    checklist: '11/12',
    checklistPct: 92,
    hours: '112h 40m',
    budgetPct: 100,
    budgetLabel: '141%',
    budgetTone: 'negative',
    budgetLabelTone: 'negative',
    rate: '$79.88/hr',
    rateTone: 'negative',
    delivered: '—'
  },
  {
    name: 'Report design',
    client: 'Ortega & Co',
    price: '$450.00',
    status: 'active',
    checklist: '3/6',
    checklistPct: 50,
    hours: '9h 05m',
    budgetPct: 100,
    budgetLabel: '151%',
    budgetTone: 'negative',
    budgetLabelTone: 'negative',
    rate: '$49.54/hr',
    rateTone: 'negative',
    delivered: '—'
  },
  {
    name: 'Packaging system',
    client: 'Marlow Foods',
    price: '$12,000.00',
    status: 'active',
    checklist: '4/16',
    checklistPct: 25,
    hours: '41h 30m',
    budgetPct: 38,
    budgetLabel: '38%',
    budgetTone: 'positive',
    budgetLabelTone: 'neutral',
    rate: '$289.16/hr',
    rateTone: 'secondary',
    delivered: '—'
  },
  {
    name: 'Editorial templates',
    client: 'Kestrel Press',
    price: '$3,200.00',
    status: 'active',
    checklist: '9/10',
    checklistPct: 90,
    hours: '27h 50m',
    budgetPct: 93,
    budgetLabel: '93%',
    budgetTone: 'warning',
    budgetLabelTone: 'warning',
    rate: '$114.97/hr',
    rateTone: 'warning',
    delivered: '—'
  },
  {
    name: 'Onboarding emails',
    client: 'Halcyon Labs',
    price: '$1,800.00',
    status: 'active',
    checklist: '5/8',
    checklistPct: 63,
    hours: '16h 20m',
    budgetPct: 82,
    budgetLabel: '82%',
    budgetTone: 'warning',
    budgetLabelTone: 'warning',
    rate: '$110.20/hr',
    rateTone: 'warning',
    delivered: '—'
  },
  {
    name: 'Trade show panels',
    client: 'Northwind Studio',
    price: '$3,400.00',
    status: 'delivered',
    checklist: '7/7',
    checklistPct: 100,
    hours: '19h 30m',
    budgetPct: 78,
    budgetLabel: '78%',
    budgetTone: 'positive',
    budgetLabelTone: 'neutral',
    rate: '$174.36/hr',
    rateTone: 'positive',
    delivered: '26 Aug'
  },
  {
    name: 'Annual report layout',
    client: 'Brandt & Vale',
    price: '$5,400.00',
    status: 'delivered',
    checklist: '9/9',
    checklistPct: 100,
    hours: '44h 15m',
    budgetPct: 98,
    budgetLabel: '98%',
    budgetTone: 'warning',
    budgetLabelTone: 'warning',
    rate: '$122.03/hr',
    rateTone: 'warning',
    delivered: '19 Aug'
  },
  {
    name: 'Menu system',
    client: 'Meridian Coffee',
    price: '$2,750.00',
    status: 'invoiced',
    checklist: '6/6',
    checklistPct: 100,
    hours: '21h 45m',
    budgetPct: 87,
    budgetLabel: '87%',
    budgetTone: 'warning',
    budgetLabelTone: 'warning',
    rate: '$126.44/hr',
    rateTone: 'positive',
    delivered: '11 Aug'
  },
  {
    name: 'Site copy refresh',
    client: 'Northwind Studio',
    price: '$2,400.00',
    status: 'paid',
    checklist: '5/5',
    checklistPct: 100,
    hours: '14h 05m',
    budgetPct: 70,
    budgetLabel: '70%',
    budgetTone: 'positive',
    budgetLabelTone: 'neutral',
    rate: '$170.44/hr',
    rateTone: 'positive',
    delivered: '28 Jun'
  },
  {
    name: 'Wholesale one-pager',
    client: 'Marlow Foods',
    price: '$900.00',
    status: 'paid',
    checklist: '4/4',
    checklistPct: 100,
    hours: '6h 10m',
    budgetPct: 62,
    budgetLabel: '62%',
    budgetTone: 'positive',
    budgetLabelTone: 'neutral',
    rate: '$145.95/hr',
    rateTone: 'positive',
    delivered: '02 Jun'
  },
  {
    name: 'Rebrand phase 2',
    client: 'Kestrel Press',
    price: '$7,500.00',
    status: 'draft',
    checklist: '0/11',
    checklistPct: null,
    hours: '0h 00m',
    budgetPct: null,
    budgetLabel: '—',
    budgetTone: 'neutral',
    budgetLabelTone: 'neutral',
    rate: '—',
    rateTone: 'neutral',
    delivered: '—'
  },
  {
    name: 'Loyalty card set',
    client: 'Meridian Coffee',
    price: '$1,200.00',
    status: 'cancelled',
    checklist: '2/5',
    checklistPct: 40,
    hours: '3h 40m',
    budgetPct: 31,
    budgetLabel: '31%',
    budgetTone: 'muted',
    budgetLabelTone: 'neutral',
    rate: '—',
    rateTone: 'neutral',
    delivered: '—'
  }
]

export function AllProjectsTable(): JSX.Element {
  return (
    <div className="panel all-projects">
      <div className="all-projects__header t-overline">
        <span>Project</span>
        <span>Client</span>
        <span className="align-right">Price</span>
        <span>Status</span>
        <span>Checklist</span>
        <span className="align-right">Hours</span>
        <span>Budget</span>
        <span className="align-right">Effective rate</span>
        <span className="align-right">Delivered</span>
      </div>

      {rows.map((row) => {
        const draft = row.status === 'draft'
        const cancelled = row.status === 'cancelled'

        return (
          <div
            className={cancelled ? 'all-projects__row all-projects__row--dim' : 'all-projects__row'}
            key={row.name}
          >
            {row.running ? (
              <div className="all-projects__name">
                <div
                  className="dot pulse"
                  style={{ background: 'var(--accent)' }}
                  aria-label="Timer running"
                />
                <span className="all-projects__label truncate">{row.name}</span>
              </div>
            ) : (
              <span
                className={[
                  'all-projects__label',
                  'all-projects__label--indented',
                  'truncate',
                  draft ? 'all-projects__label--quiet' : '',
                  cancelled ? 'all-projects__label--struck' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {row.name}
              </span>
            )}

            <span
              className={cancelled ? 'all-projects__client--quiet truncate' : 'all-projects__client truncate'}
            >
              {row.client}
            </span>

            <span
              className={
                draft || cancelled ? 'align-right all-projects__quiet' : 'align-right'
              }
            >
              {row.price}
            </span>

            <span>
              <StatusPill status={row.status} />
            </span>

            <div className="all-projects__meter-cell">
              <span
                className={
                  draft || cancelled
                    ? 'all-projects__checklist all-projects__quiet'
                    : 'all-projects__checklist'
                }
              >
                {row.checklist}
              </span>
              {row.checklistPct === null ? (
                <div className="meter" aria-hidden="true" />
              ) : (
                <Meter
                  value={row.checklistPct}
                  tone={cancelled ? 'muted' : 'neutral'}
                  label={`Checklist ${row.checklist}`}
                />
              )}
            </div>

            <span
              className={
                draft || cancelled ? 'align-right all-projects__quiet' : 'align-right all-projects__hours'
              }
            >
              {row.hours}
            </span>

            <div className="all-projects__meter-cell">
              {row.budgetPct === null ? (
                <div className="meter" aria-hidden="true" />
              ) : (
                <Meter
                  value={row.budgetPct}
                  tone={row.budgetTone}
                  label={`Budget used ${row.budgetLabel}`}
                />
              )}
              <span
                className="all-projects__budget-pct"
                style={{ color: toneVar[row.budgetLabelTone] }}
              >
                {row.budgetLabel}
              </span>
            </div>

            <span className="align-right all-projects__rate" style={{ color: toneVar[row.rateTone] }}>
              {row.rate}
            </span>

            <span className="align-right all-projects__quiet">{row.delivered}</span>
          </div>
        )
      })}

      <div className="all-projects__row all-projects__totals">
        <span className="all-projects__totals-label">14 projects · 2 not shown</span>
        <span />
        <span className="align-right all-projects__totals-value">$56,500.00</span>
        <span />
        <span />
        <span className="align-right all-projects__totals-value">344h 55m</span>
        <span />
        <span className="align-right all-projects__totals-value">$163.82/hr</span>
        <span />
      </div>
    </div>
  )
}
