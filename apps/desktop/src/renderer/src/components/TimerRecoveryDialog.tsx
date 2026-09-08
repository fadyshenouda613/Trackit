import { useState, type JSX } from 'react'
import {
  clockSpanMinutes,
  elapsedSeconds,
  formatClock,
  formatDuration,
  parseClock,
  shortDate,
  type TimeEntry
} from '@trackit/shared'

/**
 * What the dialog answers with. Trim carries the end it worked out, so the
 * shell writes a timestamp rather than re-deriving one from a clock face.
 */
export type RecoveryChoice =
  | { kind: 'keep' }
  | { kind: 'trim'; endedAt: string }
  | { kind: 'discard' }

type TimerRecoveryDialogProps = {
  /** The clock that was still running when the app came up. */
  entry: TimeEntry
  projectName: string
  /** Minutes the project already has from other entries. */
  alreadyLoggedMinutes: number
  nowMs: number
  onResolve: (choice: RecoveryChoice) => void
}

type Choice = 'keep' | 'trim' | 'discard'

/** Minutes since local midnight — the clock face the entry started at. */
const startedAtClock = (iso: string): number => {
  const date = new Date(iso)
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * `formatDuration` renders nothing under a minute as an em dash, which is right
 * in a table column and wrong in a sentence: "has been running for —". In prose
 * a run too short to round to a minute is still a run.
 */
const runLabel = (minutes: number): string =>
  minutes <= 0 ? 'under a minute' : formatDuration(minutes)

/** Whether the run began on the local day before `nowMs`. */
function startedYesterday(iso: string, nowMs: number): boolean {
  const started = new Date(iso)
  const yesterday = new Date(nowMs)
  yesterday.setDate(yesterday.getDate() - 1)
  return (
    started.getFullYear() === yesterday.getFullYear() &&
    started.getMonth() === yesterday.getMonth() &&
    started.getDate() === yesterday.getDate()
  )
}

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
export function TimerRecoveryDialog({
  entry,
  projectName,
  alreadyLoggedMinutes,
  nowMs,
  onResolve
}: TimerRecoveryDialogProps): JSX.Element {
  const STARTED = startedAtClock(entry.startedAt)
  const RAN = Math.floor(elapsedSeconds(entry.startedAt, nowMs) / 60)
  const ALREADY_LOGGED = alreadyLoggedMinutes

  /* A run with nothing in it yet cannot be trimmed to anything valid, so the
     question opens on the answer that is available. */
  const [choice, setChoice] = useState<Choice>(RAN === 0 ? 'keep' : 'trim')
  /* The run's own end, not a guess at when the day finished: the dialog opens
     valid — trimming to it logs the whole run — and editing it down is what
     makes it a trim. Anything else opens showing an error nobody typed. */
  const [trimText, setTrimText] = useState(() => formatClock((STARTED + RAN) % 1440))

  const parsed = parseClock(trimText)
  const trimmed = parsed === null ? null : clockSpanMinutes(STARTED, parsed)
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
      ? `Keep ${runLabel(RAN)}`
      : choice === 'discard'
        ? 'Discard'
        : trimValid
          ? `Log ${formatDuration(trimmed)}`
          : 'Log trimmed time'

  const choices: { key: Choice; label: JSX.Element; note: string }[] = [
    {
      key: 'keep',
      label: <>Keep all {runLabel(RAN)}</>,
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
      note:
        ALREADY_LOGGED <= 0
          ? `Nothing is logged. ${projectName} has nothing logged yet.`
          : `Nothing is logged. ${projectName} keeps the ${runLabel(ALREADY_LOGGED)} it already has.`
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
            A timer for <strong>{projectName}</strong> has been running for{' '}
            <strong>{runLabel(RAN)}</strong>{' '}
            {startedYesterday(entry.startedAt, nowMs)
              ? 'since yesterday at '
              : `since ${shortDate(entry.startedAt)} at `}
            {formatClock(STARTED)}.
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
          <span className="dialog__foot-note">Trackit stopped the timer when it quit.</span>
          <div className="spacer" />
          {/* Discarding is a legitimate answer, not the encouraged one — it gets
              the plain button rather than the accent, and never a red one. */}
          <button
            type="button"
            className={choice === 'discard' ? 'button' : 'button button--primary'}
            disabled={choice === 'trim' && !trimValid}
            onClick={() => {
              if (choice === 'keep') return onResolve({ kind: 'keep' })
              if (choice === 'discard') return onResolve({ kind: 'discard' })
              /* The button is disabled until the trim parses, so this is the
                 only branch left: the end the entry is given. */
              if (trimmed === null) return
              return onResolve({
                kind: 'trim',
                endedAt: new Date(Date.parse(entry.startedAt) + trimmed * 60_000).toISOString()
              })
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
