import { useMemo, useRef, useState, type JSX } from 'react'
import { Icon } from './Icon'
import { Meter } from './Meter'
import { withMove, type DragState } from './reorder'

export type ChecklistItem = {
  id: string
  label: string
  done: boolean
  /** Added after the project went active. Shown, never flagged. */
  addedLater?: boolean
}

/**
 * Seeds the one row the design specifies as mid-drag. It is a presentation
 * state, not a real pointer session, so the first interaction with the list
 * clears it and drag behaves normally from then on.
 */
const DEMO_DRAG: DragState = { id: 'guidelines', overId: 'stationery' }

const initialItems: ChecklistItem[] = [
  { id: 'kickoff', label: 'Kickoff call and brief sign-off', done: true },
  { id: 'interviews', label: 'Stakeholder interviews — four sessions', done: true },
  { id: 'audit', label: 'Competitive audit', done: true },
  { id: 'moodboards', label: 'Moodboards — three directions', done: true },
  { id: 'review', label: 'Direction review with Priya', done: true },
  { id: 'primary', label: 'Primary logo lockup', done: true },
  { id: 'horizontal', label: 'Horizontal logo lockup', done: true },
  { id: 'palette', label: 'Colour palette and type pairing', done: true },
  { id: 'secondary', label: 'Secondary marks for social', done: false, addedLater: true },
  { id: 'stationery', label: 'Business card and letterhead', done: false },
  { id: 'guidelines', label: 'Brand guidelines PDF', done: false },
  { id: 'avatars', label: 'Social avatar set — six platforms', done: false, addedLater: true },
  { id: 'signature', label: 'Email signature template', done: false, addedLater: true },
  { id: 'handover', label: 'Handover call and file package', done: false, addedLater: true }
]

export function ProjectChecklist(): JSX.Element {
  const [items, setItems] = useState(initialItems)
  const [drag, setDrag] = useState<DragState | null>(DEMO_DRAG)
  const [grabbed, setGrabbed] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const addRef = useRef<HTMLInputElement>(null)

  const done = items.filter((item) => item.done).length
  const total = items.length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  const later = items.filter((item) => item.addedLater).length

  // The lifted row renders in the slot it would drop into, so the list shows
  // the result of the move rather than asking the reader to imagine it.
  const order = useMemo(() => (drag ? withMove(items, drag.id, drag.overId) : items), [items, drag])

  const commit = (): void => {
    if (drag) setItems(withMove(items, drag.id, drag.overId))
    setDrag(null)
    setGrabbed(null)
  }

  const toggle = (id: string): void => {
    setDrag(null)
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    )
  }

  const rename = (id: string, label: string): void => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, label } : item)))
  }

  const remove = (id: string): void => {
    setDrag(null)
    setItems((current) => current.filter((item) => item.id !== id))
  }

  const add = (): void => {
    const label = draft.trim()
    if (!label) return
    setDrag(null)
    // The project is active, so anything added now is added after kickoff.
    setItems((current) => [
      ...current,
      { id: `item-${Date.now()}`, label, done: false, addedLater: true }
    ])
    setDraft('')
    addRef.current?.focus()
  }

  return (
    <div className="checklist">
      <div className="checklist__summary">
        <div className="checklist__summary-line">
          <span className="checklist__summary-count">
            {done} of {total} done
          </span>
          <div className="spacer" />
          <span className="checklist__summary-pct">{percent}%</span>
        </div>

        <Meter value={percent} size="lg" label={`Checklist ${done} of ${total} done`} />

        {/*
         * Scope that arrived after kickoff, stated plainly. It is the sentence
         * the freelancer reads out on a call, so it takes no colour, no icon
         * and no comparison — only the count and when it happened.
         */}
        {later > 0 && (
          <p className="checklist__later-line">
            {later} of {total} items were added after kickoff
          </p>
        )}
      </div>

      <ul className="checklist__list">
        {order.map((item) => {
          const lifted = drag?.id === item.id

          return (
            <li
              key={item.id}
              className={[
                'checklist__row',
                item.done ? 'checklist__row--done' : '',
                lifted ? 'checklist__row--lifted' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={grabbed === item.id}
              onDragStart={() => setDrag({ id: item.id, overId: item.id })}
              onDragOver={(event) => {
                if (!drag) return
                event.preventDefault()
                if (drag.overId !== item.id) setDrag({ id: drag.id, overId: item.id })
              }}
              onDrop={(event) => {
                event.preventDefault()
                commit()
              }}
              onDragEnd={commit}
            >
              {lifted && <span className="checklist__dropline" aria-hidden="true" />}

              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                className="checklist__box"
                onClick={() => toggle(item.id)}
              >
                {item.done && <Icon name="check" size={11} />}
              </button>

              <input
                className="checklist__label"
                value={item.label}
                aria-label="Item"
                onChange={(event) => rename(item.id, event.target.value)}
                onFocus={() => setDrag(null)}
              />

              {item.addedLater && <span className="checklist__later">added later</span>}

              <button
                type="button"
                className="checklist__handle"
                aria-label={`Reorder ${item.label}`}
                onMouseDown={() => setGrabbed(item.id)}
                onMouseUp={() => setGrabbed(null)}
              >
                <Icon name="grip" size={14} />
              </button>

              <button
                type="button"
                className="checklist__delete"
                aria-label={`Delete ${item.label}`}
                onClick={() => remove(item.id)}
              >
                <Icon name="close" size={11} />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="checklist__add">
        <Icon name="plus" size={13} className="checklist__add-glyph" />
        <input
          ref={addRef}
          className="checklist__add-input"
          placeholder="Add an item"
          value={draft}
          aria-label="Add a checklist item"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add()
          }}
        />
        <span className="checklist__add-hint">Return to add</span>
      </div>
    </div>
  )
}
