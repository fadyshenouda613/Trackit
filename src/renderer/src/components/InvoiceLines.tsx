import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { Icon } from './Icon'
import type { InvoiceLine } from './invoice-data'
import { money, parseMoney } from './money'
import { withMove, type DragState } from './reorder'

type InvoiceLinesProps = {
  lines: InvoiceLine[]
  onChange: (id: string, patch: Partial<InvoiceLine>) => void
  onDelete: (id: string) => void
  onReorder: (lines: InvoiceLine[]) => void
  /** Returns the new line id so the amount can take focus straight away. */
  onAdd: (label: string) => string
  symbol: string
}

/**
 * An amount typed by hand, held as text until it parses. Anything unreadable
 * reverts on blur — the same contract the time log gives a clock time, and for
 * a stronger reason: a silently mangled figure here is a wrong invoice.
 */
function AmountCell({
  value,
  label,
  focus,
  symbol,
  onCommit,
  onFocused
}: {
  value: number
  label: string
  symbol: string
  /** Set on the line just added — a line with no price is not yet a line. */
  focus: boolean
  onCommit: (amount: number) => void
  onFocused: () => void
}): JSX.Element {
  const [text, setText] = useState(() => money(value, symbol))
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => setText(money(value, symbol)), [value, symbol])

  useEffect(() => {
    if (!focus) return
    input.current?.focus()
    input.current?.select()
    onFocused()
  }, [focus, onFocused])

  const commit = (): void => {
    const parsed = parseMoney(text)
    if (parsed === null) setText(money(value, symbol))
    else onCommit(parsed)
  }

  return (
    <input
      ref={input}
      className="lines__amount num"
      value={text}
      aria-label={label}
      onChange={(event) => setText(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setText(money(value, symbol))
          event.currentTarget.blur()
        }
      }}
    />
  )
}

/**
 * The invoice itself. Ticking a project writes a line here; the line is then
 * the freelancer's, not the project's — the label and the amount are both
 * editable, because what a client is told they are paying for is rarely the
 * project name and the round number that was agreed months ago.
 */
export function InvoiceLines({
  lines,
  onChange,
  onDelete,
  onReorder,
  onAdd,
  symbol
}: InvoiceLinesProps): JSX.Element {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [grabbed, setGrabbed] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  /** The line just added, whose amount should take focus. */
  const [focusId, setFocusId] = useState<string | null>(null)

  // The lifted row renders in the slot it would drop into, so the list shows
  // the result of the move rather than asking the reader to imagine it.
  const order = useMemo(
    () => (drag ? withMove(lines, drag.id, drag.overId) : lines),
    [lines, drag]
  )

  const commit = (): void => {
    if (drag) onReorder(withMove(lines, drag.id, drag.overId))
    setDrag(null)
    setGrabbed(null)
  }

  const clearFocus = useCallback(() => setFocusId(null), [])

  /* A line with no price is not yet a line, so the amount takes focus the
     moment the description is committed. */
  const add = (): void => {
    const label = draft.trim()
    if (!label) return
    setDrag(null)
    setFocusId(onAdd(label))
    setDraft('')
  }

  return (
    <section className="panel lines" aria-label="Line items">
      <div className="lines__head">
        <h3 className="section__title">Line items</h3>
        <span className="section__count num">
          {lines.length === 0
            ? 'Nothing yet'
            : `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`}
        </span>
      </div>

      {lines.length === 0 ? (
        <p className="lines__blank">
          Tick a project above, or write a line of your own — an invoice does not have to come
          from a project.
        </p>
      ) : (
        <div className="lines__list">
          {order.map((line) => {
            const lifted = drag?.id === line.id

            return (
              <div
                key={line.id}
                className={lifted ? 'lines__row lines__row--lifted' : 'lines__row'}
                draggable={grabbed === line.id}
                onDragStart={() => setDrag({ id: line.id, overId: line.id })}
                onDragOver={(event) => {
                  if (!drag) return
                  event.preventDefault()
                  if (drag.overId !== line.id) setDrag({ id: drag.id, overId: line.id })
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  commit()
                }}
                onDragEnd={commit}
              >
                {lifted && <span className="lines__dropline" aria-hidden="true" />}

                <button
                  type="button"
                  className="lines__handle"
                  aria-label={`Reorder ${line.label}`}
                  onMouseDown={() => setGrabbed(line.id)}
                  onMouseUp={() => setGrabbed(null)}
                >
                  <Icon name="grip" size={14} />
                </button>

                <input
                  className="lines__label"
                  value={line.label}
                  aria-label="Description"
                  onChange={(event) => onChange(line.id, { label: event.target.value })}
                  onFocus={() => setDrag(null)}
                />

                <AmountCell
                  value={line.amount}
                  label={`Amount for ${line.label}`}
                  focus={focusId === line.id}
                  symbol={symbol}
                  onCommit={(amount) => onChange(line.id, { amount })}
                  onFocused={clearFocus}
                />

                <button
                  type="button"
                  className="lines__delete"
                  aria-label={`Remove ${line.label}`}
                  onClick={() => onDelete(line.id)}
                >
                  <Icon name="close" size={11} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="lines__add">
        <Icon name="plus" size={13} className="lines__add-glyph" />
        <input
          className="lines__add-input"
          placeholder="Add a line"
          value={draft}
          aria-label="Add a line item"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add()
          }}
        />
        <span className="lines__add-hint">Return to add</span>
      </div>
    </section>
  )
}
