import { Fragment, useEffect, useRef, useState, type JSX } from 'react'
import { formatClock, formatDuration, parseClock } from '@trackit/shared'
import { Icon } from './Icon'
import {
  clientFor,
  dayLabel,
  daysOf,
  durationOf,
  projectNames,
  totalOf,
  type TimeEntry,
  type Week
} from './time-data'

type TimeLogProps = {
  week: Week
  entries: TimeEntry[]
  /** The row whose description should take focus — set when a row is added. */
  focusId: string | null
  onChange: (id: string, patch: Partial<TimeEntry>) => void
  onDelete: (id: string) => void
  onFocused: () => void
}

/**
 * A time typed by hand, held as text until it parses. Anything unreadable
 * reverts on blur rather than silently logging a time nobody meant.
 */
function TimeCell({
  value,
  label,
  onCommit
}: {
  value: number
  label: string
  onCommit: (minutes: number) => void
}): JSX.Element {
  const [text, setText] = useState(() => formatClock(value))

  useEffect(() => setText(formatClock(value)), [value])

  const commit = (): void => {
    const parsed = parseClock(text)
    if (parsed === null) setText(formatClock(value))
    else onCommit(parsed)
  }

  return (
    <input
      className="time-log__cell time-log__time num"
      value={text}
      aria-label={label}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setText(formatClock(value))
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function Row({
  entry,
  focus,
  onChange,
  onDelete,
  onFocused
}: {
  entry: TimeEntry
  focus: boolean
  onChange: (id: string, patch: Partial<TimeEntry>) => void
  onDelete: (id: string) => void
  onFocused: () => void
}): JSX.Element {
  const note = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!focus) return
    note.current?.focus()
    onFocused()
  }, [focus, onFocused])

  return (
    <div className="time-log__row">
      <div className="time-log__cell time-log__pick">
        <select
          className="time-log__select truncate"
          value={entry.project}
          aria-label="Project"
          onChange={(event) => onChange(entry.id, { project: event.target.value })}
        >
          {projectNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Icon name="caret" size={11} className="time-log__caret" />
      </div>

      {/* The client follows the project — two places to change it would be two
          places for it to disagree. */}
      <span className="time-log__client truncate">{clientFor(entry.project)}</span>

      <input
        ref={note}
        className="time-log__cell time-log__note"
        value={entry.note}
        aria-label="Description"
        placeholder="What did you work on?"
        spellCheck={false}
        onChange={(event) => onChange(entry.id, { note: event.target.value })}
      />

      <TimeCell
        value={entry.startMin}
        label="Start time"
        onCommit={(startMin) => onChange(entry.id, { startMin })}
      />
      <TimeCell
        value={entry.endMin}
        label="End time"
        onCommit={(endMin) => onChange(entry.id, { endMin })}
      />

      <span className="time-log__duration num">{formatDuration(durationOf(entry))}</span>

      <button
        type="button"
        className="time-log__delete"
        aria-label={`Delete ${entry.note || 'entry'}`}
        onClick={() => onDelete(entry.id)}
      >
        <Icon name="trash" size={12} />
      </button>
    </div>
  )
}

/**
 * The week, newest day first. Days you did not work are not dropped — they are
 * drawn as a thin line, so the shape of the week survives.
 */
export function TimeLog({
  week,
  entries,
  focusId,
  onChange,
  onDelete,
  onFocused
}: TimeLogProps): JSX.Element {
  const days = daysOf(week)

  return (
    <div className="panel time-log">
      <div className="time-log__header t-overline">
        <span>Project</span>
        <span>Client</span>
        <span>Description</span>
        <span className="align-right">Start</span>
        <span className="align-right">End</span>
        <span className="align-right">Duration</span>
        <span />
      </div>

      {days.map((iso) => {
        const label = dayLabel(iso)
        const dayEntries = entries
          .filter((item) => item.iso === iso)
          .sort((a, b) => a.startMin - b.startMin)

        if (dayEntries.length === 0) {
          return (
            <div key={iso} className="time-log__blank">
              <span className="time-log__blank-label">
                {label.primary} {label.secondary}
              </span>
              <div className="time-log__blank-line" />
            </div>
          )
        }

        return (
          // A fragment, not a wrapper: every row stays a direct child of the
          // panel so the grid columns and the last-row border rule still line up.
          <Fragment key={iso}>
            <div className="time-log__day">
              <span className="time-log__day-label">
                {label.primary}
                <span className="time-log__day-date">{label.secondary}</span>
              </span>
              <span className="time-log__day-total num">{formatDuration(totalOf(dayEntries))}</span>
              <span />
            </div>

            {dayEntries.map((item) => (
              <Row
                key={item.id}
                entry={item}
                focus={item.id === focusId}
                onChange={onChange}
                onDelete={onDelete}
                onFocused={onFocused}
              />
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}
