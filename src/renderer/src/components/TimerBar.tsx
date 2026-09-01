import type { JSX } from 'react'
import { TitleBarControls } from './TitleBarControls'
import { formatDuration } from './time-data'

type TimerBarProps = {
  client: string
  project: string
  deliverable: string
  /** Everything logged to the project so far, this session included. */
  loggedMinutes: number
  budgetMinutes: number
  /** Pre-formatted: the app has no clock, so nothing here counts. */
  elapsed: string
  onStop?: () => void
}

/** "32h" reads as a budget; "32h 00m" reads as a measurement. */
const budgetLabel = (minutes: number): string =>
  minutes % 60 === 0 ? `${minutes / 60}h` : formatDuration(minutes)

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
  client,
  project,
  deliverable,
  loggedMinutes,
  budgetMinutes,
  elapsed,
  onStop
}: TimerBarProps): JSX.Element {
  const over = loggedMinutes > budgetMinutes
  const percent = Math.min(100, Math.round((loggedMinutes / budgetMinutes) * 100))

  return (
    <div className={over ? 'timer-bar timer-bar--over drag' : 'timer-bar drag'}>
      <div className="timer-bar__recording">
        <div className="timer-bar__dot pulse" />
        <span className="t-overline timer-bar__label">Recording</span>
      </div>

      <div className="timer-bar__divider" />

      <span className="timer-bar__project truncate">
        {client} — {project}
      </span>
      <span className="timer-bar__meta truncate">Deliverable: {deliverable}</span>

      <div className="spacer" />

      <div className="timer-bar__budget">
        <div className="timer-bar__meter">
          <div className="timer-bar__meter-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="timer-bar__meta num">
          {formatDuration(loggedMinutes)} of {budgetLabel(budgetMinutes)}
          {over
            ? ` · ${formatDuration(loggedMinutes - budgetMinutes)} over`
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
