import type { JSX } from 'react'
import { Meter, toneVar, type Tone } from './Meter'

type ProjectRow = {
  name: string
  client: string
  price: string
  checklist: string
  checklistPct: number
  hours: string
  /** Budget bar fill and its percentage label are toned separately: an
   *  under-budget project reads positive on the bar but neutral in the label. */
  budgetPct: number
  budgetLabel: string
  budgetTone: Tone
  budgetLabelTone: Tone
  rate: string
  rateTone: Tone
  note: string
  noteTone: Tone
  /** The one project the running timer belongs to. */
  running?: boolean
}

const rows: ProjectRow[] = [
  {
    name: 'Brand refresh',
    client: 'Northwind',
    price: '$6,500.00',
    checklist: '8/14',
    checklistPct: 57,
    hours: '28h 15m',
    budgetPct: 88,
    budgetLabel: '88%',
    budgetTone: 'warning',
    budgetLabelTone: 'warning',
    rate: '$230.09',
    rateTone: 'positive',
    note: '+130% vs floor',
    noteTone: 'neutral',
    running: true
  },
  {
    name: 'Site build',
    client: 'Sable Studio',
    price: '$9,000.00',
    checklist: '11/12',
    checklistPct: 92,
    hours: '112h 40m',
    budgetPct: 100,
    budgetLabel: '141%',
    budgetTone: 'negative',
    budgetLabelTone: 'negative',
    rate: '$79.88',
    rateTone: 'negative',
    note: '−20% below floor',
    noteTone: 'negative'
  },
  {
    name: 'Report design',
    client: 'Ortega & Co',
    price: '$450.00',
    checklist: '3/6',
    checklistPct: 50,
    hours: '9h 05m',
    budgetPct: 100,
    budgetLabel: '151%',
    budgetTone: 'negative',
    budgetLabelTone: 'negative',
    rate: '$49.54',
    rateTone: 'negative',
    note: '−50% below floor',
    noteTone: 'negative'
  },
  {
    name: 'Packaging system',
    client: 'Marlow Foods',
    price: '$12,000.00',
    checklist: '4/16',
    checklistPct: 25,
    hours: '41h 30m',
    budgetPct: 38,
    budgetLabel: '38%',
    budgetTone: 'positive',
    budgetLabelTone: 'neutral',
    rate: '$289.16',
    rateTone: 'positive',
    note: 'early · 12 items open',
    noteTone: 'neutral'
  },
  {
    name: 'Editorial templates',
    client: 'Kestrel Press',
    price: '$3,200.00',
    checklist: '9/10',
    checklistPct: 90,
    hours: '27h 50m',
    budgetPct: 93,
    budgetLabel: '93%',
    budgetTone: 'warning',
    budgetLabelTone: 'warning',
    rate: '$114.97',
    rateTone: 'warning',
    note: '+15% · marginal',
    noteTone: 'warning'
  },
  {
    name: 'Onboarding emails',
    client: 'Halcyon',
    price: '$1,800.00',
    checklist: '5/8',
    checklistPct: 63,
    hours: '16h 20m',
    budgetPct: 82,
    budgetLabel: '82%',
    budgetTone: 'warning',
    budgetLabelTone: 'warning',
    rate: '$110.20',
    rateTone: 'warning',
    note: '+10% · marginal',
    noteTone: 'warning'
  }
]

export function ProjectsTable(): JSX.Element {
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Active projects</h2>
        <span className="section__count">{rows.length}</span>
        <div className="spacer" />
        <span className="section__note">Rate floor $100.00/hr</span>
      </div>

      <div className="panel projects">
        <div className="projects__header t-overline">
          <span>Project</span>
          <span>Client</span>
          <span className="align-right">Price</span>
          <span>Checklist</span>
          <span className="align-right">Hours</span>
          <span>Budget</span>
          <span className="align-right">Effective rate</span>
        </div>

        {rows.map((row) => (
          <div className="projects__row" key={row.name}>
            <div className={row.running ? 'projects__name' : 'projects__name projects__name--indented'}>
              {row.running && (
                <div
                  className="dot pulse"
                  style={{ background: 'var(--accent)' }}
                  aria-label="Timer running"
                />
              )}
              <span className="projects__label truncate">{row.name}</span>
            </div>

            <span className="projects__client truncate">{row.client}</span>
            <span className="align-right">{row.price}</span>

            <div className="projects__checklist">
              <span className="projects__checklist-count">{row.checklist}</span>
              <Meter value={row.checklistPct} label={`Checklist ${row.checklist}`} />
            </div>

            <span className="projects__hours align-right">{row.hours}</span>

            <div className="projects__budget">
              <Meter
                value={row.budgetPct}
                tone={row.budgetTone}
                label={`Budget used ${row.budgetLabel}`}
              />
              <span
                className="projects__budget-pct"
                style={{ color: toneVar[row.budgetLabelTone] }}
              >
                {row.budgetLabel}
              </span>
            </div>

            <div className="projects__rate">
              <span className="projects__rate-value" style={{ color: toneVar[row.rateTone] }}>
                {row.rate}
                <span className="projects__rate-unit">/hr</span>
              </span>
              <span className="projects__rate-note" style={{ color: toneVar[row.noteTone] }}>
                {row.note}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
