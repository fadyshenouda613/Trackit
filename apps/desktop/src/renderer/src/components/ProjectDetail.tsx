import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { Avatar } from './Avatar'
import { noteRow } from './client-rows'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { averageDaysToPay } from './invoices-data'
import { dayMonth, longDate } from './local-dates'
import { Meter } from './Meter'
import { Pill } from './Pill'
import { projectFigures, sessionRows, statusHistory } from './project-rows'
import { ProjectChecklist } from './ProjectChecklist'
import { StatusPill } from './StatusPill'
import { TableSkeleton } from './TableSkeleton'
import { initialsOf, plural, termsLabel } from './terms'
import { toneVar } from './tone'
import {
  budgetJudgement,
  formatBudget,
  formatCents,
  formatDuration,
  symbolOf,
  type Id,
  type ProjectStatus
} from '@trackit/shared'
import { useChecklist } from '../data/use-checklist'
import { useClient } from '../data/use-clients'
import { useInvoices } from '../data/use-invoices'
import { useCreateNote, useNotes } from '../data/use-notes'
import { usePayments, usePaymentsByInvoice } from '../data/use-payments'
import {
  useProject,
  useProjectInvoice,
  useProjects,
  useTransitionProject
} from '../data/use-projects'
import { useSettings } from '../data/use-settings'
import { useTimeEntries } from '../data/use-time'

type Tab = 'scope' | 'checklist' | 'notes' | 'time'

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

type ProjectDetailProps = {
  /** The project this screen is about; everything else is read from the store. */
  projectId: Id
  /** Delivered is the one step that opens a screen rather than just moving on. */
  onCreateInvoice: () => void
  onOpenClient: (id: Id) => void
  onOpenInvoice: (id: Id) => void
  /** "Mark as paid" on an invoiced project: open its invoice with the payment dialog up. */
  onRecordPayment: (invoiceId: Id) => void
  onBack: () => void
  /** Fires once the project reaches delivered, so the shell can say so. */
  onDelivered?: (project: string) => void
  /**
   * Forces the checklist's reorder notice with sample content, for the States
   * panel. A real lost move shows it on its own.
   */
  reorderSample?: boolean
  /** Rows not in yet. */
  loading?: boolean
}

/**
 * The screen a freelancer lives in while a project runs: what it is worth, how
 * far through it is, and what the hours have done to the rate — then the work
 * itself, with the client's facts kept in view beside it.
 */
export function ProjectDetail({
  projectId,
  onCreateInvoice,
  onOpenClient,
  onOpenInvoice,
  onRecordPayment,
  onBack,
  onDelivered,
  reorderSample = false,
  loading = false
}: ProjectDetailProps): JSX.Element | null {
  const [tab, setTab] = useState<Tab>('checklist')
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  /* Escape unmounts the textarea while it still has focus; the blur that
     follows can reach the stale onBlur closure from the render being torn
     down. A ref survives by identity, so the flag is visible to it too. */
  const cancelledRef = useRef(false)

  const project = useProject(projectId)
  const clientId = project.data?.clientId ?? null
  const client = useClient(clientId)
  const checklist = useChecklist(projectId)
  const time = useTimeEntries({ projectId })
  const notes = useNotes({ projectId })
  const projectInvoice = useProjectInvoice(projectId)
  const invoice = projectInvoice.data ?? null
  const payments = usePayments(invoice?.id ?? null)
  /* Only the rail's "pays in N days on average" needs these two. */
  const clientInvoices = useInvoices(clientId === null ? undefined : { clientId })
  const clientInvoiceIds = useMemo(
    () => (clientInvoices.data ?? []).map((entry) => entry.id),
    [clientInvoices.data]
  )
  const clientPayments = usePaymentsByInvoice(clientInvoiceIds)
  const clientProjects = useProjects(clientId === null ? undefined : { clientId })
  const settings = useSettings()
  const transition = useTransitionProject()
  const createNote = useCreateNote()

  /* Forced from the States panel: a local database answers in under a frame,
     so this is the only way the Data axis is reviewable on this screen. */
  if (loading) return <TableSkeleton block="projects" rows={3} />

  /* A single-row read, so there is nothing to draw a skeleton of yet. */
  if (project.data === undefined) return null

  if (project.data === null) {
    return (
      <EmptyState
        variant="screen"
        title="That project is gone"
        body="It may have been deleted on another machine."
        action={{ label: 'Back to projects', onClick: onBack }}
      />
    )
  }

  const record = project.data
  const now = new Date().toISOString()
  const items = checklist.data ?? []
  const entries = time.data ?? []
  const noteRows = (notes.data ?? []).map(noteRow)

  const f = projectFigures(record, client.data ? [client.data] : [], entries, items, now)
  const symbol = f.symbol
  const floorCents = settings.data?.rateFloorCents ?? 0
  const rate = f.rateCents
  const rateTone = rate === null ? 'neutral' : rate >= floorCents ? 'positive' : 'negative'
  const budget = f.budget
  const budgetPercent = budget.percent ?? 0
  const budgetTone = budgetJudgement(budgetPercent)

  const sessions = sessionRows(f.entries, now)
  const firstStartedAt =
    f.entries.length === 0
      ? null
      : [...f.entries].sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0].startedAt
  const sessionsNote = firstStartedAt
    ? `Across ${plural(f.entries.length, 'session')} since ${dayMonth(firstStartedAt)}`
    : 'No sessions yet'

  const history = statusHistory(record, invoice, payments.data ?? [])
  const others = (clientProjects.data ?? []).filter((entry) => entry.id !== record.id).length
  const avgDays = averageDaysToPay(clientInvoices.data ?? [], clientPayments.data ?? {})

  const tabs: { key: Tab; label: string; meta?: string }[] = [
    { key: 'scope', label: 'Scope' },
    { key: 'checklist', label: 'Checklist', meta: `${f.checklist.done}/${f.checklist.total}` },
    { key: 'notes', label: 'Notes', meta: String(noteRows.length) },
    { key: 'time', label: 'Time', meta: String(f.entries.length) }
  ]

  /** The single step that moves a project forward. Paid and cancelled are ends. */
  const steps: Partial<Record<ProjectStatus, { label: string; run: () => void }>> = {
    draft: {
      label: 'Mark as active',
      run: () => transition.mutate({ id: projectId, to: 'active' })
    },
    active: {
      label: 'Mark as delivered',
      run: () =>
        transition.mutate(
          { id: projectId, to: 'delivered' },
          /* The pill changing is visible; what is worth saying is what it
             unlocked, and only the store can say the move landed. */
          { onSuccess: (updated) => onDelivered?.(updated.name) }
        )
    },
    /* The invoice is what makes a delivered project invoiced, so this step
       opens the screen that raises it rather than flipping a pill. */
    delivered: { label: 'Create invoice', run: onCreateInvoice },
    invoiced: {
      label: 'Mark as paid',
      run: () => {
        if (invoice) onRecordPayment(invoice.id)
      }
    }
  }
  const next = steps[record.status] ?? null

  const onCancel = (): void => {
    transition.mutate({ id: projectId, to: 'cancelled' })
  }

  const submitNote = (): void => {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    const body = draft.trim()
    if (body) {
      createNote.mutate({ id: crypto.randomUUID(), projectId, clientId: null, body, pinned: false })
    }
    setComposing(false)
    setDraft('')
  }

  return (
    <div className="project">
      <header className="project__head">
        <div className="project__identity">
          <div className="project__title-line">
            <h2 className="t-title">{record.name}</h2>
            <StatusPill status={record.status} />
          </div>
          <div className="project__client-line">
            <a
              href="#"
              className="project__client"
              onClick={(event) => {
                event.preventDefault()
                if (client.data) onOpenClient(client.data.id)
              }}
            >
              {client.data?.company || client.data?.name || '—'}
            </a>
            <span className="project__sep">·</span>
            <span>Fixed price</span>
            <span className="project__sep">·</span>
            <span className="num">Due {record.dueAt ? longDate(record.dueAt) : '—'}</span>
          </div>
        </div>

        <div className="spacer" />

        <div className="project__actions">
          <OverflowMenu onCancel={onCancel} />
          {next && (
            <button type="button" className="button button--primary" onClick={next.run}>
              {next.label}
            </button>
          )}
        </div>
      </header>

      {/*
       * Five figures on one line. The effective rate is the only one that
       * answers "was this worth doing", so it is the largest and the only one
       * that takes colour; the other four are the working it shows.
       */}
      <section className="panel project__metrics" aria-label="Project figures">
        <div className="project__metric">
          <span className="t-overline project__metric-label">Price</span>
          <span className="project__metric-value num">
            {formatCents(record.priceCents, symbol)}
          </span>
          <span className="project__metric-note">
            Agreed {dayMonth(record.kickoffAt ?? record.createdAt)} · one invoice at delivery
          </span>
        </div>

        <div className="project__metric">
          <span className="t-overline project__metric-label">Checklist</span>
          <span className="project__metric-value num">
            {f.checklist.done}
            <span className="project__metric-unit">/{f.checklist.total}</span>
          </span>
          <Meter
            value={f.checklist.percent}
            size="lg"
            label={`Checklist ${f.checklist.done} of ${f.checklist.total} done`}
          />
          <span className="project__metric-note">
            {f.checklist.percent}% done · {plural(f.checklist.open, 'item')} open
          </span>
        </div>

        <div className="project__metric">
          <span className="t-overline project__metric-label">Hours</span>
          <span className="project__metric-value num">{formatDuration(f.loggedMinutes)}</span>
          <span className="project__metric-note">{sessionsNote}</span>
        </div>

        <div className="project__metric">
          <span className="t-overline project__metric-label">Effective rate</span>
          <span className="project__rate num" style={{ color: toneVar[rateTone] }}>
            {rate === null ? '—' : formatCents(rate, symbol)}
            {rate !== null && <span className="project__rate-unit">/hr</span>}
          </span>
          <span className="project__metric-note">
            {rate === null
              ? 'No hours logged yet'
              : rate >= floorCents
                ? `Earning ${formatCents(rate - floorCents, symbol)}/hr over your ${formatCents(floorCents, symbol)} floor`
                : `Running ${formatCents(floorCents - rate, symbol)}/hr under your ${formatCents(floorCents, symbol)} floor`}
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
              ? `${formatDuration(budget.overMinutes)} over a ${formatBudget(f.budgetMinutes)} budget`
              : `${formatDuration(budget.remainingMinutes)} left of a ${formatBudget(f.budgetMinutes)} budget`}
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
            {tab === 'checklist' && (
              <ProjectChecklist projectId={projectId} items={items} reorderSample={reorderSample} />
            )}

            {tab === 'scope' && (
              <div className="scope">
                <p className="scope__body t-body">
                  {record.description || 'No description yet'}
                </p>
                <div className="scope__grid">
                  <div className="scope__cell">
                    <span className="t-overline scope__label">Price basis</span>
                    <span className="scope__value">
                      Fixed price · {formatCents(record.priceCents, symbol)}
                    </span>
                  </div>
                  <div className="scope__cell">
                    <span className="t-overline scope__label">Hours budget</span>
                    <span className="scope__value num">{formatBudget(f.budgetMinutes)}</span>
                  </div>
                  {/* Neither has a field on the project, so neither can claim
                      one. Both are the schema's silence, stated. */}
                  <div className="scope__cell">
                    <span className="t-overline scope__label">Revisions</span>
                    <span className="scope__value">—</span>
                  </div>
                  <div className="scope__cell">
                    <span className="t-overline scope__label">Not included</span>
                    <span className="scope__value">—</span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'notes' && (
              <div className="project-notes">
                {composing && (
                  <div className="project-notes__entry">
                    <textarea
                      className="field field--filled"
                      rows={2}
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={submitNote}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                          event.currentTarget.blur()
                        }
                        if (event.key === 'Escape') {
                          cancelledRef.current = true
                          setDraft('')
                          setComposing(false)
                        }
                      }}
                    />
                  </div>
                )}

                {notes.isSuccess && noteRows.length === 0 && !composing ? (
                  <EmptyState
                    variant="panel"
                    title="No notes yet"
                    body="Anything worth remembering about this project."
                  />
                ) : (
                  noteRows.map((note, index) => (
                    <div className="project-notes__entry" key={note.id}>
                      {(index > 0 || composing) && <div className="project-notes__rule" />}
                      <span className="project-notes__date num">{note.date}</span>
                      <p className="project-notes__body t-body">{note.body}</p>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  className="project-notes__add"
                  onClick={() => setComposing(true)}
                >
                  Add note
                </button>
              </div>
            )}

            {tab === 'time' && (
              <div className="sessions">
                {sessions.length === 0 ? (
                  /* Only a read that came back may say nothing was logged; a
                     refused one has already said what happened, as a toast. */
                  time.isSuccess ? (
                    <EmptyState
                      variant="panel"
                      title="No hours logged"
                      body="Start the timer or add an entry on the Time screen."
                    />
                  ) : null
                ) : (
                  <>
                    {sessions.map((session) => (
                      <div className="sessions__row" key={session.id}>
                        <span className="sessions__date num">{session.date}</span>
                        <span className="sessions__note truncate">{session.note}</span>
                        <span className="sessions__length num">{session.length}</span>
                      </div>
                    ))}
                    <div className="sessions__row sessions__row--total">
                      <span className="sessions__date">Total</span>
                      <span className="sessions__note">
                        {f.entries.length} sessions since{' '}
                        {firstStartedAt ? dayMonth(firstStartedAt) : '—'}
                      </span>
                      <span className="sessions__length num">
                        {formatDuration(f.loggedMinutes)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stays put whichever tab is open: the facts you quote on a call. */}
        <aside className="rail" aria-label="Project details">
          <section className="panel rail__card">
            <span className="t-overline rail__title">Client</span>
            <div className="rail__client">
              <Avatar initials={initialsOf(client.data?.name ?? '')} tone="accent" />
              <div className="rail__client-names">
                <a
                  href="#"
                  className="rail__client-name"
                  onClick={(event) => {
                    event.preventDefault()
                    if (client.data) onOpenClient(client.data.id)
                  }}
                >
                  {client.data?.name ?? '—'}
                </a>
                <span className="rail__client-company">{client.data?.company ?? ''}</span>
              </div>
            </div>
            <a href="#" className="rail__link">
              {client.data?.email ?? '—'}
            </a>
            <div className="rail__pills">
              <Pill>
                {client.data
                  ? `${client.data.currency} (${symbolOf(client.data.currency)})`
                  : '—'}
              </Pill>
              <Pill>{client.data ? termsLabel(client.data.paymentTermsDays) : '—'}</Pill>
            </div>
            <span className="rail__aside">
              {plural(others, 'other project')}
              {avgDays === null ? '' : ` · pays in ${avgDays} days on average`}
            </span>
          </section>

          <section className="panel rail__card">
            <span className="t-overline rail__title">Dates</span>
            <dl className="rail__dates">
              <dt>Created</dt>
              <dd className="num">{longDate(record.createdAt)}</dd>
              <dt>Kickoff</dt>
              <dd className={record.kickoffAt ? 'num' : 'num rail__dates-empty'}>
                {record.kickoffAt ? longDate(record.kickoffAt) : '—'}
              </dd>
              <dt>Due</dt>
              <dd className={record.dueAt ? 'num' : 'num rail__dates-empty'}>
                {record.dueAt ? longDate(record.dueAt) : '—'}
              </dd>
              <dt>Delivered</dt>
              <dd className={record.deliveredAt ? 'num' : 'num rail__dates-empty'}>
                {record.deliveredAt ? longDate(record.deliveredAt) : '—'}
              </dd>
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
            {invoice ? (
              <a
                href="#"
                className="rail__invoice"
                onClick={(event) => {
                  event.preventDefault()
                  onOpenInvoice(invoice.id)
                }}
              >
                <span className="rail__invoice-number">{invoice.number}</span>
                <span className="rail__invoice-total num">
                  {formatCents(invoice.totalCents, symbolOf(invoice.currency))}
                </span>
                <StatusPill status={invoice.status} />
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
