import { useState, type JSX } from 'react'
import { formatClock, formatDuration, parseClock } from './time-data'

type TimerRecoveryDialogProps = {
  onResolve: () => void
}

type Choice = 'keep' | 'trim' | 'discard'

/* The run being recovered: started 4:10 PM yesterday, still going at 6:32 AM. */
const PROJECT = 'Brand refresh'
const STARTED = 16 * 60 + 10
const RAN = 14 * 60 + 22
const ALREADY_LOGGED = 28 * 60 + 15

/**
 * Shown on launch when the app finds a timer that was never stopped.
 *
 * The tone is the whole design here. Nothing was lost and nothing is broken —
 * a laptop closed on a Thursday evening is not an incident — so there is no
 * red, no warning glyph and no exclamation. It asks one question and offers the
 * three answers, with the likeliest one (trim) carrying the input.
 *
 * Unlike the other dialogs there is no close button and no Esc handler: the
 * timer has to become something, even if that something is nothing.
 */
export function TimerRecoveryDialog({ onResolve }: TimerRecoveryDialogProps): JSX.Element {
  const [choice, setChoice] = useState<Choice>('trim')
  const [trimText, setTrimText] = useState('6:00 PM')

  const parsed = parseClock(trimText)
  const trimmed = parsed === null ? null : (parsed - STARTED + 1440) % 1440
  const trimValid = trimmed !== null && trimmed > 0 && trimmed <= RAN

  const trimNote = (): string => {
    if (parsed === null) return 'Enter a time like 6:00 PM.'
    if (!trimValid) {
      return `That is outside the run. Pick a time between ${formatClock(
        STARTED
      )} and ${formatClock(STARTED + RAN)}.`
    }
    return `Logs ${formatDuration(trimmed)}, from ${formatClock(STARTED)} to ${formatClock(
      parsed
    )}.`
  }

  const confirmLabel =
    choice === 'keep'
      ? `Keep ${formatDuration(RAN)}`
      : choice === 'discard'
        ? 'Discard'
        : trimValid
          ? `Log ${formatDuration(trimmed)}`
          : 'Log trimmed time'

  const choices: { key: Choice; label: JSX.Element; note: string }[] = [
    {
      key: 'keep',
      label: <>Keep all {formatDuration(RAN)}</>,
      note: 'Logs the whole run, ending now.'
    },
    {
      key: 'trim',
      label: (
        <>
          Trim it to
          <input
            className="recovery__trim-input num"
            value={trimText}
            aria-label="Trim the timer to"
            onFocus={() => setChoice('trim')}
            onChange={(event) => setTrimText(event.target.value)}
          />
        </>
      ),
      note: trimNote()
    },
    {
      key: 'discard',
      label: <>Discard it</>,
      note: `Nothing is logged. ${PROJECT} keeps the ${formatDuration(
        ALREADY_LOGGED
      )} it already has.`
    }
  ]

  return (
    <div className="scrim">
      <div className="dialog">
        <div className="dialog__head">
          <h2 className="dialog__title">Pick up where you left off</h2>
        </div>

        <div className="dialog__body">
          <p className="t-body recovery__lede">
            A timer for <strong>{PROJECT}</strong> has been running for{' '}
            <strong>{formatDuration(RAN)}</strong> since yesterday at {formatClock(STARTED)}.
          </p>
          <p className="recovery__hint">
            It most likely kept going after you finished for the day. Choose what to log — you
            can edit the entry afterwards.
          </p>

          <div className="recovery__choices" role="radiogroup" aria-label="What to log">
            {choices.map((option) => (
              <label
                key={option.key}
                className={
                  option.key === choice ? 'recovery__choice recovery__choice--on' : 'recovery__choice'
                }
              >
                <input
                  type="radio"
                  name="recovery"
                  className="recovery__radio"
                  checked={option.key === choice}
                  onChange={() => setChoice(option.key)}
                />
                <span className="recovery__choice-body">
                  <span className="recovery__choice-label">{option.label}</span>
                  <span className="recovery__choice-note">{option.note}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="dialog__foot">
          <span className="dialog__foot-note">Ledgerline stopped the timer when it quit.</span>
          <div className="spacer" />
          {/* Discarding is a legitimate answer, not the encouraged one — it gets
              the plain button rather than the accent, and never a red one. */}
          <button
            type="button"
            className={choice === 'discard' ? 'button' : 'button button--primary'}
            disabled={choice === 'trim' && !trimValid}
            onClick={onResolve}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
