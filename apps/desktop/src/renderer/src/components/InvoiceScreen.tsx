import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { BillableProjects } from './BillableProjects'
import { Icon } from './Icon'
import { InvoiceLines } from './InvoiceLines'
import { InvoiceRail } from './InvoiceRail'
import { TopBar } from './TopBar'
import {
  addDays,
  nextInvoiceNumber,
  nextInvoiceSequence,
  shortDate,
  symbolOf,
  type Id,
  type Project
} from '@trackit/shared'
import {
  billableView,
  draftSubtotal,
  lineFromProject,
  newLine,
  toNewInvoiceInput,
  type LineDraft
} from './invoices-data'
import { todayIso } from './local-dates'
import { termsLabel } from './terms'
import { useClients } from '../data/use-clients'
import { useCreateInvoice, useInvoices } from '../data/use-invoices'
import { useBillableProjects, useProjectInvoices, useProjects } from '../data/use-projects'
import { useSettings } from '../data/use-settings'

type InvoiceScreenProps = {
  isTopmost: boolean
  /** Where the breadcrumb goes back to — this screen is reached two ways. */
  back: { label: string; onClick: () => void }
  /**
   * Set when the screen was opened from a project: whoever is paying for that
   * project is the one fact the entry point carries, and asking for it again
   * would be asking the freelancer to repeat themselves.
   */
  initialClientId?: Id
  /**
   * And the project it was raised from, which opens already ticked: "create an
   * invoice for this project" is an answer, not a question to ask back. Ignored
   * if that project is not billable — already invoiced work is not offered.
   */
  initialProjectId?: Id
  onOpenProjects: () => void
  /** The draft the store wrote, so the screen it lands on is that record. */
  onSaved: (id: Id) => void
}

/**
 * Create invoice, on one screen.
 *
 * Not a wizard. Choosing the client, picking the work, wording the lines and
 * reading the total are not four steps — they are four things the freelancer
 * checks against each other, and a wizard would put a page break between every
 * pair of them. So the screen reveals rather than advances: the client at the
 * top decides what the middle can contain, and the right-hand column adds it up
 * as it fills.
 *
 * Like TimeScreen, it owns its whole header, because the footer acts on the
 * body between them.
 */
export function InvoiceScreen({
  isTopmost,
  back,
  initialClientId,
  initialProjectId,
  onOpenProjects,
  onSaved
}: InvoiceScreenProps): JSX.Element {
  const [clientId, setClientId] = useState<Id | ''>(initialClientId ?? '')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [typedTaxRate, setTypedTaxRate] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const clients = useClients()
  const settings = useSettings()
  /* The whole register, for the numbers the scheme counts past. */
  const register = useInvoices()
  const billable = useBillableProjects(clientId || null)
  const clientProjects = useProjects({ clientId: clientId || undefined })
  const create = useCreateInvoice()

  const clientList = clients.data ?? []
  const client = clientList.find((entry) => entry.id === clientId) ?? null
  const billableList = useMemo(() => billable.data ?? [], [billable.data])
  const projectList = useMemo(
    () => (clientId ? (clientProjects.data ?? []) : []),
    [clientId, clientProjects.data]
  )

  /* The delivered work that is spoken for: each one names the invoice it went
     out on, which is the answer to "didn't I already bill that?". */
  const invoicedIds = useMemo(
    () =>
      projectList
        .filter(
          (p) =>
            p.status === 'invoiced' ||
            p.status === 'paid' ||
            (p.status === 'delivered' && !billableList.some((b) => b.id === p.id))
        )
        .map((p) => p.id),
    [projectList, billableList]
  )
  const projectInvoices = useProjectInvoices(invoicedIds)

  /* What is on offer only moves when the store does, so it is worked out when
     the store moves rather than on every keystroke in the rail beside it. */
  const view = useMemo(
    () => (client ? billableView(client, projectList, billableList, projectInvoices.data ?? {}) : null),
    [client, projectList, billableList, projectInvoices.data]
  )

  const today = todayIso()
  /* The invoice is written in the client currency throughout, symbol included;
     before a client is chosen the settings default stands in. */
  const currency = client?.currency ?? settings.data?.currency ?? 'USD'
  const symbol = symbolOf(currency)

  /* What the scheme expects the next number to be. Shown, not typed: the
     server issues the number when the draft is saved, and this is only the
     likeliest answer — the one a draft raised offline holds until it syncs. */
  const expectedNumber = settings.data
    ? (nextInvoiceNumber(
        settings.data.numberingScheme,
        nextInvoiceSequence(
          (register.data ?? []).map((invoice) => invoice.number),
          settings.data.numberingScheme
        ),
        new Date()
      ) ?? '')
    : ''
  const defaultTaxRate = settings.data && settings.data.taxRate > 0 ? String(settings.data.taxRate) : ''
  const taxRate = typedTaxRate ?? defaultTaxRate

  /* One invoice, one client: changing it starts the invoice again rather than
     carrying another client's work across. */
  const chooseClient = (id: string): void => {
    setClientId(id)
    setLines([])
  }

  /* The ticks are not held separately — the lines are the invoice, so the list
     above reads its state back off them and the two can never disagree. */
  const selected = lines
    .map((line) => line.projectId)
    .filter((id): id is Id => id !== null)

  const toggle = (project: Project): void => {
    setLines((current) =>
      current.some((line) => line.projectId === project.id)
        ? current.filter((line) => line.projectId !== project.id)
        : [...current, lineFromProject(project)]
    )
  }

  /*
   * The tick the entry point already made. It has to wait for the billable list
   * — until that answers there is no project to tick — and it happens once: a
   * seed that ran again would put the line back after it was deliberately
   * unticked. Untouched if the project is not on the list, because delivered
   * work that is already invoiced is not on offer.
   */
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || initialProjectId === undefined) return
    const project = billableList.find((entry) => entry.id === initialProjectId)
    if (!project) return
    seeded.current = true
    toggle(project)
  }, [initialProjectId, billableList])

  const change = (id: Id, patch: Partial<LineDraft>): void => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  const remove = (id: Id): void => {
    setLines((current) => current.filter((line) => line.id !== id))
  }

  const add = (label: string): Id => {
    const line = newLine(label)
    setLines((current) => [...current, line])
    return line.id
  }

  const ready = clientId !== '' && lines.length > 0

  const save = (): void => {
    if (!ready || create.isPending) return
    create.mutate(toNewInvoiceInput({ clientId, currency, taxRate, notes, lines }), {
      onSuccess: (invoice) => onSaved(invoice.id)
    })
  }

  return (
    <>
      <TopBar
        breadcrumb={{ label: back.label, onClick: back.onClick }}
        title="New invoice"
        meta="Draft"
        isTopmost={isTopmost}
      />

      <div className="main__content">
        <div className="invoice__body">
          <div className="invoice__work">
            <section className="panel invoice__client">
              <div className="field-row">
                <label htmlFor="inv-client">Bill to</label>
                <div className="select-wrap">
                  <select
                    id="inv-client"
                    className={clientId ? 'field field--filled' : 'field'}
                    value={clientId}
                    onChange={(event) => chooseClient(event.target.value)}
                  >
                    <option value="">Choose a client…</option>
                    {clientList.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.company} — {entry.name}
                      </option>
                    ))}
                  </select>
                  <Icon name="caret" size={12} className="select-wrap__caret" />
                </div>
                <span className="field-row__hint">
                  {client
                    ? `Billed in ${client.currency} (${symbol}) on ${termsLabel(client.paymentTermsDays).toLowerCase()} terms, from this client's record.`
                    : 'Everything below follows from this — the work on offer, the currency and the due date.'}
                </span>
              </div>
            </section>

            {client && view ? (
              <>
                <BillableProjects
                  view={view}
                  selected={selected}
                  symbol={symbol}
                  onToggle={toggle}
                  onOpenProjects={onOpenProjects}
                />
                <InvoiceLines
                  lines={lines}
                  onChange={change}
                  onDelete={remove}
                  onReorder={setLines}
                  onAdd={add}
                  symbol={symbol}
                />
              </>
            ) : (
              /* Nothing is hidden — the shape of the screen is visible before it
                 has anything in it, so choosing a client fills a form you have
                 already seen rather than conjuring one. */
              <section className="panel invoice__prompt">
                <p className="invoice__prompt-title">Choose a client to see what is ready to bill</p>
                <p className="invoice__prompt-body">
                  Their delivered, unbilled projects appear here as a list you tick. Anything you
                  tick becomes a line you can reword, reprice and reorder before it goes out.
                </p>
              </section>
            )}
          </div>

          <InvoiceRail
            expectedNumber={expectedNumber}
            issue={shortDate(today)}
            due={client ? shortDate(addDays(today, client.paymentTermsDays)) : '—'}
            terms={client ? termsLabel(client.paymentTermsDays) : null}
            taxRate={taxRate}
            onTaxRate={setTypedTaxRate}
            subtotalCents={client ? draftSubtotal(lines) : null}
            notes={notes}
            onNotes={setNotes}
            symbol={symbol}
          />
        </div>
      </div>

      <div className="invoice__foot">
        <span className="invoice__foot-note">
          {ready
            ? 'Saved as a draft — nothing is sent until you say so.'
            : 'An invoice needs at least one line.'}
        </span>
        <div className="spacer" />
        <button
          type="button"
          className="button"
          disabled={!ready || create.isPending}
          onClick={save}
        >
          Save as draft
        </button>
        <button type="button" className="button button--primary" disabled={!ready}>
          Generate PDF
        </button>
      </div>
    </>
  )
}
