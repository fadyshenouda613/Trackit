import type { JSX } from 'react'
import { TitleBarControls } from './TitleBarControls'
import { useNow } from './use-now'
import {
  budgetConsumption,
  elapsedSeconds,
  formatBudget,
  formatDuration,
  formatElapsed,
  type Client,
  type Project,
  type TimeEntry
} from '@trackit/shared'

type TimerBarProps = {
  /** The running entry. Its `startedAt` is the clock; nothing here accumulates. */
  entry: TimeEntry
  project: Project
  client: Client
  /** The checklist item the timer was started on, or '' when it was not. */
  deliverable: string
  /** Everything logged to the project so far, this session included. */
  loggedMinutes: number
  budgetMinutes: number
  onStop?: () => void
}

/**
 * "Spans the full window above everything and only exists while a timer runs."
 * When it is absent the top bar takes over the window-drag duty.
 *
 * Two states. Under budget it is the app's one accent surface. Over budget the
 * whole bar moves to the negative family — the design system assigns --negative
 * to "overdue, over budget, below floor", and a bar you are looking at for
 * hours is the right place to say so. The dot keeps pulsing either way: the
 * timer is still running, which is the whole point of the warning.
 */
export function TimerBar({
  entry,
  client,
  project,
  deliverable,
  loggedMinutes,
  budgetMinutes,
  onStop
}: TimerBarProps): JSX.Element {
  /* The second hand lives here and nowhere else. The shell above ticks once a
     minute, which is all its date and its meter need; a clock in a bar is the
     one thing in this window that has to move every second, so only this
     component is re-rendered that often. */
  const nowMs = useNow(1000)
  const budget = budgetConsumption(loggedMinutes, budgetMinutes)
  const over = budget.over
  const percent = Math.min(100, budget.percent ?? 0)
  /* Computed from the stored start every tick, never counted up: a machine
     that slept through the night wakes with the right figure. */
  const elapsed = formatElapsed(elapsedSeconds(entry.startedAt, nowMs))

  return (
    <div className={over ? 'timer-bar timer-bar--over drag' : 'timer-bar drag'}>
      <div className="timer-bar__recording">
        <div className="timer-bar__dot pulse" />
        <span className="t-overline timer-bar__label">Recording</span>
      </div>

      <div className="timer-bar__divider" />

      <span className="timer-bar__project truncate">
        {client.company || client.name} — {project.name}
      </span>
      {/* A timer started from the project rather than from one of its
          deliverables has nothing to name, so the line goes rather than
          standing empty. */}
      {deliverable && <span className="timer-bar__meta truncate">Deliverable: {deliverable}</span>}

      <div className="spacer" />

      <div className="timer-bar__budget">
        <div className="timer-bar__meter">
          <div className="timer-bar__meter-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="timer-bar__meta num">
          {formatDuration(loggedMinutes)} of {formatBudget(budgetMinutes)}
          {over
            ? ` · ${formatDuration(budget.overMinutes)} over`
            : ` · ${percent}% of budget`}
        </span>
      </div>

      <span className="timer-bar__elapsed">{elapsed}</span>

      <button type="button" className="timer-bar__stop no-drag" onClick={onStop}>
        <span className="timer-bar__stop-glyph" />
        Stop
      </button>

      <TitleBarControls />
    </div>
  )
}
