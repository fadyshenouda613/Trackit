import { useState, type JSX } from 'react'
import { BillableProjects } from './BillableProjects'
import { Icon } from './Icon'
import { InvoiceLines } from './InvoiceLines'
import { InvoiceRail } from './InvoiceRail'
import { TopBar } from './TopBar'
import {
  ISSUE_DATE,
  NEXT_NUMBER,
  billingClients,
  clientById,
  dueDateFor,
  newLineId,
  subtotalOf,
  symbolFor,
  type BillableProject,
  type InvoiceLine
} from './invoice-data'

type InvoiceScreenProps = {
  isTopmost: boolean
  /** Where the breadcrumb goes back to — this screen is reached two ways. */
  back: { label: string; onClick: () => void }
  /**
   * Set when the screen was opened from a project: whoever is paying for that
   * project is the one fact the entry point carries, and asking for it again
   * would be asking the freelancer to repeat themselves.
   */
  initialClientId?: string
  onOpenProjects: () => void
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
  initialClientId = '',
  onOpenProjects
}: InvoiceScreenProps): JSX.Element {
  const [clientId, setClientId] = useState(initialClientId)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [number, setNumber] = useState(NEXT_NUMBER)
  const [taxRate, setTaxRate] = useState('')
  const [notes, setNotes] = useState('')

  const client = clientId ? clientById(clientId) : null
  /* The invoice is written in the client currency throughout, symbol included. */
  const symbol = client ? symbolFor(client.currency) : '$'

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
    .filter((id): id is string => Boolean(id))

  const toggle = (project: BillableProject): void => {
    setLines((current) =>
      current.some((line) => line.projectId === project.id)
        ? current.filter((line) => line.projectId !== project.id)
        : [
            ...current,
            {
              id: project.id,
              label: project.name,
              amount: project.price,
              projectId: project.id
            }
          ]
    )
  }

  const change = (id: string, patch: Partial<InvoiceLine>): void => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  const remove = (id: string): void => {
    setLines((current) => current.filter((line) => line.id !== id))
  }

  const add = (label: string): string => {
    const id = newLineId()
    setLines((current) => [...current, { id, label, amount: 0 }])
    return id
  }

  const ready = lines.length > 0

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
                    {billingClients.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.company} — {entry.contact}
                      </option>
                    ))}
                  </select>
                  <Icon name="caret" size={12} className="select-wrap__caret" />
                </div>
                <span className="field-row__hint">
                  {client
                    ? `Billed in ${client.currency} on ${client.terms.toLowerCase()} terms, from this client's record.`
                    : 'Everything below follows from this — the work on offer, the currency and the due date.'}
                </span>
              </div>
            </section>

            {client ? (
              <>
                <BillableProjects
                  client={client}
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
            number={number}
            onNumber={setNumber}
            issue={ISSUE_DATE}
            due={client ? dueDateFor(client.termDays) : '—'}
            terms={client ? client.terms : null}
            taxRate={taxRate}
            onTaxRate={setTaxRate}
            subtotal={client ? subtotalOf(lines) : null}
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
        <button type="button" className="button" disabled={!ready}>
          Save as draft
        </button>
        <button type="button" className="button button--primary" disabled={!ready}>
          Generate PDF
        </button>
      </div>
    </>
  )
}
