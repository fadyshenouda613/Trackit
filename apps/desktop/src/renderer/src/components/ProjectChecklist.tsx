import { useMemo, useRef, useState, type JSX } from 'react'
import { ReorderConflictNotice, sampleReorderConflicts } from './ConflictNotice'
import { Icon } from './Icon'
import { Meter } from './Meter'
import {
  bySortOrder,
  checklistProgress,
  sortOrderForAppend,
  sortOrderForMove,
  withMove,
  type ChecklistItem,
  type Id
} from '@trackit/shared'
import type { DragState } from './reorder'
import { useConflicts, useResolveConflict } from '../data/use-sync'
import {
  useCreateChecklistItem,
  useDeleteChecklistItem,
  useUpdateChecklistItem
} from '../data/use-checklist'

type ProjectChecklistProps = {
  projectId: Id
  items: ChecklistItem[]
  /** Forces the reorder notice with sample content, for the States panel. */
  reorderSample?: boolean
}

export function ProjectChecklist({
  projectId,
  items,
  reorderSample = false
}: ProjectChecklistProps): JSX.Element {
  /* Moves on this list that lost to another device's. The sample stands in
     for them under the panel, and is dismissed locally since it is nobody's. */
  const [sampleShown, setSampleShown] = useState(true)
  const conflicts = useConflicts()
  const resolve = useResolveConflict()
  const lostMoves = useMemo(
    () => (conflicts.data ?? []).filter((conflict) => conflict.kind === 'reorder' && conflict.projectId === projectId),
    [conflicts.data, projectId]
  )
  const shownMoves = reorderSample && sampleShown ? sampleReorderConflicts : lostMoves
  const settleMoves = (resolution: 'keepTheirs' | 'restoreMine'): void => {
    if (reorderSample && sampleShown) {
      setSampleShown(false)
      return
    }
    for (const conflict of lostMoves) resolve.mutate({ id: conflict.id, resolution })
  }
  const [drag, setDrag] = useState<DragState | null>(null)
  const [grabbed, setGrabbed] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  /*
   * A rename is buffered per row: a write on every keystroke would be a row of
   * sync changes for one edit. The store hears about it when the field is left
   * or Return is pressed, and the buffer is dropped once the refetch has landed
   * so the row never flickers back to the old label.
   */
  const [labels, setLabels] = useState<Record<Id, string>>({})
  const addRef = useRef<HTMLInputElement>(null)

  const create = useCreateChecklistItem()
  const update = useUpdateChecklistItem()
  const del = useDeleteChecklistItem()

  const ordered = useMemo(() => [...items].sort(bySortOrder), [items])
  const { done, total, percent } = checklistProgress(items)
  const later = items.filter((item) => item.addedAfterKickoff).length

  // The lifted row renders in the slot it would drop into, so the list shows
  // the result of the move rather than asking the reader to imagine it.
  const order = useMemo(
    () => (drag ? withMove(ordered, drag.id, drag.overId) : ordered),
    [ordered, drag]
  )

  const forget = (id: Id): void =>
    setLabels((current) => {
      const rest = { ...current }
      delete rest[id]
      return rest
    })

  /* One row's sortOrder, not a renumbered list: the midpoint of its new
     neighbours is the whole move, and one row is what syncs. */
  const commit = (): void => {
    if (drag) {
      const sortOrder = sortOrderForMove(ordered, drag.id, drag.overId)
      if (sortOrder !== null) update.mutate({ id: drag.id, projectId, patch: { sortOrder } })
    }
    setDrag(null)
    setGrabbed(null)
  }

  const toggle = (item: ChecklistItem): void => {
    setDrag(null)
    update.mutate({ id: item.id, projectId, patch: { done: !item.done } })
  }

  const commitLabel = (item: ChecklistItem): void => {
    const buffered = labels[item.id]
    if (buffered === undefined) return
    const label = buffered.trim()
    if (!label || label === item.label) {
      forget(item.id)
      return
    }
    update.mutate(
      { id: item.id, projectId, patch: { label } },
      { onSuccess: () => forget(item.id) }
    )
  }

  const remove = (id: Id): void => {
    setDrag(null)
    del.mutate({ id, projectId })
  }

  const add = (): void => {
    const label = draft.trim()
    if (!label) return
    setDrag(null)
    /* `addedAfterKickoff` is not ours to say — the store reads the project's
       state at the moment of creation and sets it. */
    create.mutate({
      id: crypto.randomUUID(),
      projectId,
      label,
      done: false,
      sortOrder: sortOrderForAppend(ordered)
    })
    setDraft('')
    addRef.current?.focus()
  }

  return (
    <div className="checklist">
      {/* Above the summary, because the count and the order are what changed. */}
      {shownMoves.length > 0 && (
        <ReorderConflictNotice
          conflicts={shownMoves}
          onKeepTheirs={() => settleMoves('keepTheirs')}
          onRestoreMine={() => settleMoves('restoreMine')}
        />
      )}

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
                onClick={() => toggle(item)}
              >
                {item.done && <Icon name="check" size={11} />}
              </button>

              <input
                className="checklist__label"
                value={labels[item.id] ?? item.label}
                aria-label="Item"
                onChange={(event) =>
                  setLabels((current) => ({ ...current, [item.id]: event.target.value }))
                }
                onFocus={() => setDrag(null)}
                onBlur={() => commitLabel(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />

              {item.addedAfterKickoff && <span className="checklist__later">added later</span>}

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
