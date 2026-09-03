import { useEffect, useRef, useState, type JSX } from 'react'
import { Avatar } from './Avatar'
import { RecordConflictNotice } from './ConflictNotice'
import { Icon } from './Icon'
import { Meter } from './Meter'
import { Pill } from './Pill'
import { ProjectChecklist } from './ProjectChecklist'
import { StatusPill } from './StatusPill'
import {
  budgetConsumption,
  budgetJudgement,
  effectiveRateCents,
  formatBudget,
  formatCents,
  formatDuration,
  formatMoney,
  hoursToMinutes,
  toCents
} from '@trackit/shared'
import { toneVar } from './tone'
import type { Status } from './status'

/* The three figures the header does arithmetic on: $6,500.00 against the
   28h 15m logged below, judged against a 32h budget. Everything the metrics
   row shows is derived from these, so no caption can disagree with the number
   beside it. */
const PRICE_CENTS = 650000
const LOGGED_MINUTES = 28 * 60 + 15
const BUDGET_MINUTES = hoursToMinutes(32)
const EFFECTIVE_RATE_CENTS = effectiveRateCents(PRICE_CENTS, LOGGED_MINUTES) ?? 0
const budget = budgetConsumption(LOGGED_MINUTES, BUDGET_MINUTES)
const budgetPercent = budget.percent ?? 0
const budgetTone = budgetJudgement(budgetPercent)

/** The single step that moves a project forward. Paid and cancelled are ends. */
const advance: Partial<Record<Status, { label: string; to: Status; entry: string }>> = {
  draft: { label: 'Mark as active', to: 'active', entry: 'Marked active' },
  active: { label: 'Mark as delivered', to: 'delivered', entry: 'Marked delivered' },
  delivered: { label: 'Create invoice', to: 'invoiced', entry: 'Invoiced — INV-0148' },
  invoiced: { label: 'Mark as paid', to: 'paid', entry: 'Paid in full' }
}

type Tab = 'scope' | 'checklist' | 'notes' | 'time'

const tabs: { key: Tab; label: string; meta?: string }[] = [
  { key: 'scope', label: 'Scope' },
  { key: 'checklist', label: 'Checklist', meta: '8/14' },
  { key: 'notes', label: 'Notes', meta: '2' },
  { key: 'time', label: 'Time', meta: '7' }
]

const sessions = [
  { date: '28 Aug', note: 'Logo lockup refinements', length: '3h 20m' },
  { date: '26 Aug', note: 'Colour palette and type pairing', length: '5h 45m' },
  { date: '22 Aug', note: 'Direction review with Priya', length: '1h 10m' },
  { date: '20 Aug', note: 'Moodboards — three directions', length: '8h 05m' },
  { date: '15 Aug', note: 'Competitive audit', length: '4h 30m' },
  { date: '13 Aug', note: 'Stakeholder interviews', length: '3h 55m' },
  { date: '12 Aug', note: 'Kickoff call and brief', length: '1h 30m' }
]

const notes = [
  {
    date: '27 Aug 2026',
    body: 'Priya asked for social avatars and an email signature on top of the agreed brief. Both are on the checklist, marked added later — raise at the delivery call rather than mid-stream.'
  },
  {
    date: '12 Aug 2026',
    body: 'Brief signed off on the call. Two rounds of revisions included; anything past that is quoted separately.'
  }
]

type MenuProps = {
  onCancel: () => void
}

/** Everything that is not the workflow step, kept out of the header. */
function OverflowMenu({ onCancel }: MenuProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="overflow" ref={wrap}>
      <button
        type="button"
        className="button button--icon"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more" size={15} />
      </button>

      {open && (
        <div className="overflow__menu" role="menu">
          <button type="button" className="overflow__item" role="menuitem">
            Edit project
          </button>
          <button type="button" className="overflow__item" role="menuitem">
            Duplicate project
          </button>
          <button type="button" className="overflow__item" role="menuitem">
            Export time entries
          </button>
          <div className="overflow__rule" />
          <button
            type="button"
            className="overflow__item overflow__item--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onCancel()
            }}
          >
            Cancel project
          </button>
        </div>
      )}
    </div>
  )
}

type HistoryEntry = { label: string; date: string }

type ProjectDetailProps = {
  /** Delivered is the one step that opens a screen rather than just moving on. */
  onCreateInvoice?: () => void
  /** The rate every project is judged against, from Settings. */
  rateFloor: number
  /** Fires once the project reaches delivered, so the shell can say so. */
  onDelivered?: (project: string) => void
  /** Whether this project came back from a sync disagreeing with itself. */
  conflict?: boolean
  /** The same, for the checklist's order — a separate disagreement. */
  reorderConflict?: boolean
}

/**
 * The screen a freelancer lives in while a project runs: what it is worth, how
 * far through it is, and what the hours have done to the rate — then the work
 * itself, with the client's facts kept in view beside it.
 */
export function ProjectDetail({
  onCreateInvoice,
  rateFloor,
  onDelivered,
  conflict = false,
  reorderConflict = false
}: ProjectDetailProps): JSX.Element {
  const [status, setStatus] = useState<Status>('active')
  const [conflictShown, setConflictShown] = useState(true)
  const [tab, setTab] = useState<Tab>('checklist')
  const [history, setHistory] = useState<HistoryEntry[]>([
    { label: 'Draft created', date: '8 Aug 2026' },
    { label: 'Marked active', date: '12 Aug 2026' }
  ])

  const next = advance[status]
  const invoiced = status === 'invoiced' || status === 'paid'
  const floorCents = toCents(rateFloor)

  const onAdvance = (): void => {
    if (!next) return
    setStatus(next.to)
    setHistory((current) => [...current, { label: next.entry, date: '1 Sep 2026' }])
    /* The pill changing is visible; what is worth saying is what it unlocked. */
    if (next.to === 'delivered') onDelivered?.('Brand refresh')
    /* The invoice is what makes a delivered project invoiced, so this step
       opens the screen that raises it rather than only flipping the pill. */
    if (status === 'delivered') onCreateInvoice?.()
  }

  const onCancel = (): void => {
    setStatus('cancelled')
    setHistory((current) => [...current, { label: 'Cancelled', date: '1 Sep 2026' }])
  }

  return (
    <div className="project">
      <header className="project__head">
        <div className="project__identity">
          <div className="project__title-line">
            <h2 className="t-title">Brand refresh</h2>
            <StatusPill status={status} />
          </div>
          <div className="project__client-line">
            <a href="#" className="project__client">
              Northwind Studio
            </a>
            <span className="project__sep">·</span>
            <span>Fixed price</span>
            <span className="project__sep">·</span>
            <span className="num">Due 11 Sep 2026</span>
          </div>
        </div>

        <div className="spacer" />

        <div className="project__actions">
          <OverflowMenu onCancel={onCancel} />
          {next && (
            <button type="button" className="button button--primary" onClick={onAdvance}>
              {next.label}
            </button>
          )}
        </div>
      </header>

      {/* Above the figures, because it is a caveat on all five of them: two of
          these numbers are the ones that disagreed. */}
      {conflict && conflictShown && (
        <RecordConflictNotice onDismiss={() => setConflictShown(false)} />
      )}

      {/*
       * Five figures on one line. The effective rate is the only one that
       * answers "was this worth doing", so it is the largest and the only one
       * that takes colour; the other four are the working it shows.
       */}
      <section className="panel project__metrics" aria-label="Project figures">
        <div className="project__metric">
          <span className="t-overline project__metric-label">Price</span>
          <span className="project__metric-value num">{formatCents(PRICE_CENTS)}</span>
          <span className="project__metric-note">Agreed 12 Aug · one invoice at delivery</span>
        </div>

        <div className="project__metric">
          <span className="t-overline project__metric-label">Checklist</span>
          <span className="project__metric-value num">
            8<span className="project__metric-unit">/14</span>
          </span>
          <Meter value={57} size="lg" label="Checklist 8 of 14 done" />
          <span className="project__metric-note">57% done · 6 items open</span>
        </div>

        <div className="project__metric">
          <span className="t-overline project__metric-label">Hours</span>
          <span className="project__metric-value num">{formatDuration(LOGGED_MINUTES)}</span>
          <span className="project__metric-note">Across 7 sessions since 12 Aug</span>
        </div>

        <div className="project__metric">
          <span className="t-overline project__metric-label">Effective rate</span>
          <span
            className="project__rate num"
            style={{ color: toneVar[EFFECTIVE_RATE_CENTS >= floorCents ? 'positive' : 'negative'] }}
          >
            {formatCents(EFFECTIVE_RATE_CENTS)}
            <span className="project__rate-unit">/hr</span>
          </span>
          <span className="project__metric-note">
            {EFFECTIVE_RATE_CENTS >= floorCents
              ? `Earning ${formatCents(EFFECTIVE_RATE_CENTS - floorCents)}/hr over your ${formatMoney(rateFloor)} floor`
              : `Running ${formatCents(floorCents - EFFECTIVE_RATE_CENTS)}/hr under your ${formatMoney(rateFloor)} floor`}
          </span>
        </div>

        <div className="project__metric">
          <span className="t-overline project__metric-label">Budget</span>
          <span className="project__metric-value num" style={{ color: toneVar[budgetTone] }}>
            {budgetPercent}%
          </span>
          <Meter
            value={budgetPercent}
            tone={budgetTone}
            size="lg"
            label={`Budget used ${budgetPercent}%`}
          />
          <span className="project__metric-note">
            {budget.over
              ? `${formatDuration(budget.overMinutes)} over a ${formatBudget(BUDGET_MINUTES)} budget`
              : `${formatDuration(budget.remainingMinutes)} left of a ${formatBudget(BUDGET_MINUTES)} budget`}
          </span>
        </div>
      </section>

      <div className="project__body">
        <div className="project__work">
          <div className="tabs" role="tablist" aria-label="Project sections">
            {tabs.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={tab === entry.key}
                className={tab === entry.key ? 'tabs__tab tabs__tab--on' : 'tabs__tab'}
                onClick={() => setTab(entry.key)}
              >
                {entry.label}
                {entry.meta && <span className="tabs__meta num">{entry.meta}</span>}
              </button>
            ))}
          </div>

          <div className="panel project__pane" role="tabpanel">
            {tab === 'checklist' && <ProjectChecklist conflict={reorderConflict} />}

            {tab === 'scope' && (
              <div className="scope">
                <p className="scope__body t-body">
                  A full identity refresh for Northwind Studio: primary and horizontal lockups, a
                  colour palette, a type pairing, and the stationery and guidelines needed to hand
                  it over. Two rounds of revisions are included.
                </p>
                <div className="scope__grid">
                  <div className="scope__cell">
                    <span className="t-overline scope__label">Price basis</span>
                    <span className="scope__value">Fixed price · $6,500.00</span>
                  </div>
                  <div className="scope__cell">
                    <span className="t-overline scope__label">Hours budget</span>
                    <span className="scope__value num">32h</span>
                  </div>
                  <div className="scope__cell">
                    <span className="t-overline scope__label">Revisions</span>
                    <span className="scope__value">Two rounds included</span>
                  </div>
                  <div className="scope__cell">
                    <span className="t-overline scope__label">Not included</span>
                    <span className="scope__value">Web build, photography, print buying</span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'notes' && (
              <div className="project-notes">
                {notes.map((note, index) => (
                  <div className="project-notes__entry" key={note.date}>
                    {index > 0 && <div className="project-notes__rule" />}
                    <span className="project-notes__date num">{note.date}</span>
                    <p className="project-notes__body t-body">{note.body}</p>
                  </div>
                ))}
                <button type="button" className="project-notes__add">
                  Add note
                </button>
              </div>
            )}

            {tab === 'time' && (
              <div className="sessions">
                {sessions.map((session) => (
                  <div className="sessions__row" key={session.date + session.note}>
                    <span className="sessions__date num">{session.date}</span>
                    <span className="sessions__note truncate">{session.note}</span>
                    <span className="sessions__length num">{session.length}</span>
                  </div>
                ))}
                <div className="sessions__row sessions__row--total">
                  <span className="sessions__date">Total</span>
                  <span className="sessions__note">7 sessions since 12 Aug</span>
                  <span className="sessions__length num">28h 15m</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stays put whichever tab is open: the facts you quote on a call. */}
        <aside className="rail" aria-label="Project details">
          <section className="panel rail__card">
            <span className="t-overline rail__title">Client</span>
            <div className="rail__client">
              <Avatar initials="PR" tone="accent" />
              <div className="rail__client-names">
                <a href="#" className="rail__client-name">
                  Priya Raghunathan
                </a>
                <span className="rail__client-company">Northwind Studio</span>
              </div>
            </div>
            <a href="#" className="rail__link">
              priya@northwindstudio.com
            </a>
            <div className="rail__pills">
              <Pill>USD ($)</Pill>
              <Pill>Net 14</Pill>
            </div>
            <span className="rail__aside">3 other projects · pays in 6 days on average</span>
          </section>

          <section className="panel rail__card">
            <span className="t-overline rail__title">Dates</span>
            <dl className="rail__dates">
              <dt>Created</dt>
              <dd className="num">8 Aug 2026</dd>
              <dt>Kickoff</dt>
              <dd className="num">12 Aug 2026</dd>
              <dt>Due</dt>
              <dd className="num">11 Sep 2026</dd>
              <dt>Delivered</dt>
              <dd className="num rail__dates-empty">{invoiced ? '1 Sep 2026' : '—'}</dd>
            </dl>
          </section>

          <section className="panel rail__card">
            <span className="t-overline rail__title">Status history</span>
            <ol className="rail__history">
              {history.map((entry, index) => (
                <li
                  className={
                    index === history.length - 1 ? 'rail__event rail__event--now' : 'rail__event'
                  }
                  key={entry.label}
                >
                  <span className="rail__event-mark" aria-hidden="true" />
                  <span className="rail__event-label">{entry.label}</span>
                  <span className="rail__event-date num">{entry.date}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel rail__card">
            <span className="t-overline rail__title">Invoice</span>
            {invoiced ? (
              <a href="#" className="rail__invoice">
                <span className="rail__invoice-number">INV-0148</span>
                <span className="rail__invoice-total num">$6,500.00</span>
                <StatusPill status={status === 'paid' ? 'paid' : 'sent'} />
              </a>
            ) : (
              <p className="rail__empty">
                No invoice yet. One can be raised as soon as the project is delivered.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
