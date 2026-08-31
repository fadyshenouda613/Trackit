import type { JSX } from 'react'
import { Icon } from './Icon'
import { toneVar, type Tone } from './Meter'

type AttentionItem = {
  tone: Tone
  subject: string
  detail: string
  action: string
}

const items: AttentionItem[] = [
  {
    tone: 'negative',
    subject: 'Chase Ortega & Co',
    detail: '— INV-0142 is 24 days overdue, $2,100.00',
    action: 'Send reminder'
  },
  {
    tone: 'negative',
    subject: 'Renegotiate Site build',
    detail: '— $79.88/hr, 20% under your $100.00 floor at 112h 40m logged',
    action: 'Open project'
  },
  {
    tone: 'negative',
    subject: 'Re-scope Report design',
    detail: '— 151% of budgeted hours spent against 3 of 6 deliverables done',
    action: 'Open project'
  },
  {
    tone: 'warning',
    subject: 'Bill added scope on Packaging system',
    detail: '— 3 deliverables added since kickoff, price unchanged',
    action: 'Review scope'
  },
  {
    tone: 'warning',
    subject: 'Watch Editorial templates',
    detail: '— 93% of budgeted hours used with 1 deliverable open',
    action: 'Open project'
  },
  {
    tone: 'warning',
    subject: 'Chase Halcyon',
    detail: '— INV-0139 is 6 days overdue, $860.00',
    action: 'Send reminder'
  }
]

export function AttentionList(): JSX.Element {
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Attention</h2>
        <span className="section__count">{items.length}</span>
      </div>

      <div className="panel">
        {items.map((item) => (
          <div className="attention__row" key={item.subject}>
            <div className="dot" style={{ background: toneVar[item.tone] }} aria-hidden="true" />
            <span>
              <span className="attention__subject">{item.subject}</span>{' '}
              <span className="attention__detail">{item.detail}</span>
            </span>
            <div className="spacer" />
            <span className="attention__action">{item.action}</span>
            <Icon name="chevron" size={12} className="attention__chevron" />
          </div>
        ))}
      </div>
    </section>
  )
}
