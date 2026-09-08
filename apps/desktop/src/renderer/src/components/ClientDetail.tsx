import { useMemo, useRef, useState, type JSX } from 'react'
import { symbolOf, type Id } from '@trackit/shared'
import { Avatar } from './Avatar'
import {
  clientHeader,
  clientInvoiceRow,
  clientProjectRow,
  noteRow
} from './client-rows'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { todayIso } from './local-dates'
import { Pill } from './Pill'
import { StatusPill } from './StatusPill'
import { TableSkeleton } from './TableSkeleton'
import { toneVar } from './tone'
import { useClient } from '../data/use-clients'
import { useCreateNote, useNotes } from '../data/use-notes'
import { usePaymentsByInvoice } from '../data/use-payments'
import { useProjects } from '../data/use-projects'
import { useInvoices } from '../data/use-invoices'
import { useTimeEntries } from '../data/use-time'

type ClientDetailProps = {
  clientId: Id
  onOpenProject: (id: Id) => void
  onOpenInvoice: (id: Id) => void
  /** Rows not in yet. */
  loading?: boolean
}

/**
 * "Projects, invoices and notes stacked — nothing hidden behind a tab."
 */
export function ClientDetail({
  clientId,
  onOpenProject,
  onOpenInvoice,
  loading = false
}: ClientDetailProps): JSX.Element {
  const client = useClient(clientId)
  const projects = useProjects({ clientId })
  const invoices = useInvoices({ clientId })
  const invoiceIds = useMemo(() => (invoices.data ?? []).map((i) => i.id), [invoices.data])
  const payments = usePaymentsByInvoice(invoiceIds)
  const entries = useTimeEntries()
  const notes = useNotes({ clientId })
  const createNote = useCreateNote()
  const today = todayIso()

  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  /* Escape unmounts the textarea while it still has focus, and the native
     blur that follows can reach React's delegated listener as the stale
     onBlur={submitNote} closure from the render that is being torn down —
     the one that captured the cancelled text. A ref survives across renders
     by identity, so setting it synchronously in the Escape handler is visible
     to that stale closure too, whichever `submitNote` it holds. */
  const cancelledRef = useRef(false)

  if (client.data === undefined) {
    return (
      <div className="detail">
        <section className="section">
          <TableSkeleton block="all-projects" rows={4} />
        </section>
        <div className="detail__split">
          <section className="section">
            <TableSkeleton block="invoices" rows={4} />
          </section>
          <section className="section" />
        </div>
      </div>
    )
  }

  if (client.data === null) {
    return (
      <EmptyState
        variant="screen"
        title="That client is gone"
        body="It may have been deleted, or the link that brought you here is stale."
        action={{ label: 'Back to clients' }}
      />
    )
  }

  const record = client.data
  const symbol = symbolOf(record.currency)
  const nowIso = new Date().toISOString()

  const header = clientHeader(
    record,
    projects.data ?? [],
    invoices.data ?? [],
    payments.data ?? {},
    today
  )

  const projectRows = (projects.data ?? []).map((p) =>
    clientProjectRow(p, entries.data ?? [], symbol, nowIso)
  )
  const invoiceRows = (invoices.data ?? []).map(clientInvoiceRow)
  const noteRows = (notes.data ?? []).map(noteRow)

  const projectsPending = loading || projects.isPending || entries.isPending
  const invoicesPending = loading || invoices.isPending || payments.isPending
  const notesPending = loading || notes.isPending

  const submitNote = (): void => {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    const body = draft.trim()
    if (body) {
      createNote.mutate({ id: crypto.randomUUID(), clientId, projectId: null, body, pinned: false })
    }
    setComposing(false)
    setDraft('')
  }

  return (
    <div className="detail">
      <header className="detail__head">
        <Avatar initials={header.initials} size="lg" tone="accent" />

        <div className="detail__identity">
          <div className="detail__names">
            <h2 className="t-title">{header.name}</h2>
            <span className="detail__company">{header.company}</span>
          </div>

          <div className="detail__contact">
            <a href="#">{header.email}</a>
            <span className="detail__sep">·</span>
            <span className="num">{header.phone}</span>
            <span className="detail__sep">·</span>
            <span>{header.addressLine}</span>
            <span className="detail__sep">·</span>
            <Pill>{header.currencyPill}</Pill>
            <Pill>{header.termsPill}</Pill>
          </div>
        </div>

        <div className="spacer" />

        <div className="detail__metrics">
          <div className="detail__metric">
            <span className="t-overline detail__metric-label">Lifetime billed</span>
            <span className="detail__metric-value">{header.lifetime}</span>
            <span className="detail__metric-note num">{header.lifetimeNote}</span>
          </div>
          <div className="detail__metric-rule" />
          <div className="detail__metric">
            <span className="t-overline detail__metric-label">Outstanding</span>
            <span className="detail__metric-value">{header.outstanding}</span>
            <span
              className={
                header.outstandingTone === 'positive'
                  ? 'detail__metric-note detail__metric-note--positive num'
                  : 'detail__metric-note num'
              }
              style={header.outstandingTone === 'negative' ? { color: toneVar.negative } : undefined}
            >
              {header.outstandingNote}
            </span>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="section__head">
          <h3 className="section__title">Projects</h3>
          <span className="section__count">{projectRows.length}</span>
        </div>

        {projectsPending ? (
          <TableSkeleton block="all-projects" rows={4} />
        ) : (
          <div className="panel detail-projects">
            <div className="detail-projects__header t-overline">
              <span>Project</span>
              <span>Status</span>
              <span className="align-right">Price</span>
              <span className="align-right">Logged</span>
              <span className="align-right">Effective rate</span>
              <span />
            </div>

            {projectRows.length === 0 ? (
              /* Only a read that came back may say there are none; a refused
                 one has already said what happened, as a toast. */
              projects.isSuccess ? (
                <EmptyState variant="panel" title="No projects yet" body="Nothing kicked off for this client yet." />
              ) : null
            ) : (
              projectRows.map((row) => (
                <div
                  className="detail-projects__row"
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenProject(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpenProject(row.id)
                    }
                  }}
                >
                  <span className="detail-projects__name truncate">{row.name}</span>
                  <span>
                    <StatusPill status={row.status} />
                  </span>
                  <span className="align-right">{row.price}</span>
                  <span className="align-right detail-projects__logged">{row.logged}</span>
                  <span className="align-right detail-projects__rate">{row.rate}</span>
                  <Icon name="chevron" size={12} className="clients__chevron" />
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <div className="detail__split">
        <section className="section">
          <div className="section__head">
            <h3 className="section__title">Invoices</h3>
            <span className="section__count">{invoiceRows.length}</span>
          </div>

          {invoicesPending ? (
            <TableSkeleton block="invoices" rows={4} />
          ) : (
            <div className="panel detail-invoices">
              <div className="detail-invoices__header t-overline">
                <span>Number</span>
                <span>Issued</span>
                <span className="align-right">Total</span>
                <span className="align-right">Status</span>
              </div>

              {invoiceRows.length === 0 ? (
                invoices.isSuccess ? (
                  <EmptyState
                    variant="panel"
                    title="No invoices yet"
                    body="Deliver a project and raise one from it."
                  />
                ) : null
              ) : (
                invoiceRows.map((row) => (
                  <div
                    className="detail-invoices__row"
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenInvoice(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpenInvoice(row.id)
                      }
                    }}
                  >
                    <span className="detail-invoices__number">{row.number}</span>
                    <span className="detail-invoices__issued">{row.issued}</span>
                    <span className="align-right">{row.total}</span>
                    <span className="align-right">
                      <StatusPill status={row.status} />
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section__head">
            <h3 className="section__title">Notes</h3>
            <div className="spacer" />
            <button type="button" className="detail__add-note" onClick={() => setComposing(true)}>
              Add note
            </button>
          </div>

          <div className="panel detail-notes">
            {composing && (
              <div className="detail-notes__group">
                <div className="detail-notes__entry">
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
              </div>
            )}

            {!notesPending && notes.isSuccess && noteRows.length === 0 && !composing ? (
              <EmptyState
                variant="panel"
                title="No notes"
                body="Anything worth remembering before the next project."
              />
            ) : (
              noteRows.map((note, index) => (
                <div className="detail-notes__group" key={note.id}>
                  {(index > 0 || composing) && <div className="detail-notes__rule" />}
                  <div className="detail-notes__entry">
                    <span className="detail-notes__date num">{note.date}</span>
                    <p className="detail-notes__body">{note.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
