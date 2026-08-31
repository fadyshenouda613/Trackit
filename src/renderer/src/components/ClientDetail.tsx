import type { JSX } from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Pill } from './Pill'
import { StatusPill } from './StatusPill'
import type { Status } from './status'

type ProjectRow = {
  name: string
  status: Status
  price: string
  logged: string
  rate: string
}

const projects: ProjectRow[] = [
  {
    name: 'Brand refresh',
    status: 'active',
    price: '$6,500.00',
    logged: '28h 15m',
    rate: '$230.09/hr'
  },
  {
    name: 'Trade show panels',
    status: 'delivered',
    price: '$3,400.00',
    logged: '19h 30m',
    rate: '$174.36/hr'
  },
  {
    name: 'Site copy refresh',
    status: 'paid',
    price: '$2,400.00',
    logged: '14h 05m',
    rate: '$170.44/hr'
  },
  {
    name: 'Packaging refresh 2025',
    status: 'archived',
    price: '$9,800.00',
    logged: '62h 20m',
    rate: '$157.22/hr'
  }
]

type InvoiceRow = {
  number: string
  issued: string
  total: string
  status: Status
}

const invoices: InvoiceRow[] = [
  {
    number: 'INV-0148',
    issued: '24 Aug 2026',
    total: '$6,500.00',
    status: 'sent'
  },
  {
    number: 'INV-0131',
    issued: '02 Jul 2026',
    total: '$2,400.00',
    status: 'paid'
  },
  {
    number: 'INV-0119',
    issued: '14 May 2026',
    total: '$9,800.00',
    status: 'paid'
  },
  {
    number: 'INV-0104',
    issued: '03 Mar 2026',
    total: '$7,200.00',
    status: 'paid'
  }
]

const notes = [
  {
    date: '21 Aug 2026',
    body: 'Prefers a single invoice at delivery rather than a deposit. Approvals go through Priya only — do not route work to the marketing team.'
  },
  {
    date: '04 Jun 2026',
    body: 'Paid every invoice within 6 days in 2026. Safe to keep Net 14 and skip deposits.'
  }
]

/**
 * "Projects, invoices and notes stacked — nothing hidden behind a tab."
 * Content is Priya Raghunathan's, the one client the artboard specifies.
 */
export function ClientDetail(): JSX.Element {
  return (
    <div className="detail">
      <header className="detail__head">
        <Avatar initials="PR" size="lg" tone="accent" />

        <div className="detail__identity">
          <div className="detail__names">
            <h2 className="t-title">Priya Raghunathan</h2>
            <span className="detail__company">Northwind Studio</span>
          </div>

          <div className="detail__contact">
            <a href="#">priya@northwindstudio.com</a>
            <span className="detail__sep">·</span>
            <span className="num">+1 415 555 0182</span>
            <span className="detail__sep">·</span>
            <span>418 Turk Street, San Francisco, CA 94102</span>
            <span className="detail__sep">·</span>
            <Pill>USD ($)</Pill>
            <Pill>Net 14</Pill>
          </div>
        </div>

        <div className="spacer" />

        <div className="detail__metrics">
          <div className="detail__metric">
            <span className="t-overline detail__metric-label">Lifetime billed</span>
            <span className="detail__metric-value">$48,200.00</span>
            <span className="detail__metric-note num">9 projects since Mar 2024</span>
          </div>
          <div className="detail__metric-rule" />
          <div className="detail__metric">
            <span className="t-overline detail__metric-label">Outstanding</span>
            <span className="detail__metric-value">$6,500.00</span>
            <span className="detail__metric-note detail__metric-note--positive num">
              1 invoice · due in 7 days
            </span>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="section__head">
          <h3 className="section__title">Projects</h3>
          <span className="section__count">{projects.length}</span>
        </div>

        <div className="panel detail-projects">
          <div className="detail-projects__header t-overline">
            <span>Project</span>
            <span>Status</span>
            <span className="align-right">Price</span>
            <span className="align-right">Logged</span>
            <span className="align-right">Effective rate</span>
            <span />
          </div>

          {projects.map((row) => (
            <div className="detail-projects__row" key={row.name}>
              <span className="detail-projects__name truncate">{row.name}</span>
              <span>
                <StatusPill status={row.status} />
              </span>
              <span className="align-right">{row.price}</span>
              <span className="align-right detail-projects__logged">{row.logged}</span>
              <span className="align-right detail-projects__rate">{row.rate}</span>
              <Icon name="chevron" size={12} className="clients__chevron" />
            </div>
          ))}
        </div>
      </section>

      <div className="detail__split">
        <section className="section">
          <div className="section__head">
            <h3 className="section__title">Invoices</h3>
            <span className="section__count">{invoices.length}</span>
          </div>

          <div className="panel detail-invoices">
            <div className="detail-invoices__header t-overline">
              <span>Number</span>
              <span>Issued</span>
              <span className="align-right">Total</span>
              <span className="align-right">Status</span>
            </div>

            {invoices.map((row) => (
              <div className="detail-invoices__row" key={row.number}>
                <span className="detail-invoices__number">{row.number}</span>
                <span className="detail-invoices__issued">{row.issued}</span>
                <span className="align-right">{row.total}</span>
                <span className="align-right">
                  <StatusPill status={row.status} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <h3 className="section__title">Notes</h3>
            <div className="spacer" />
            <button type="button" className="detail__add-note">
              Add note
            </button>
          </div>

          <div className="panel detail-notes">
            {notes.map((note, index) => (
              <div className="detail-notes__group" key={note.date}>
                {index > 0 && <div className="detail-notes__rule" />}
                <div className="detail-notes__entry">
                  <span className="detail-notes__date num">{note.date}</span>
                  <p className="detail-notes__body">{note.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
