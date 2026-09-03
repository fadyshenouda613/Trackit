import { useEffect, useRef, type JSX } from 'react'
import { Icon } from './Icon'
import { agoLabel, clockOf } from './time-data'
import {
  failureReasons,
  footerLabel,
  pendingLines,
  pendingTotal,
  syncTones,
  type SyncSnapshot
} from './sync-data'
import { toneVar } from './tone'

type SyncPopoverProps = {
  snapshot: SyncSnapshot
  now: number
  onClose: () => void
  /** Returns focus to the footer button, which is where the keyboard came from. */
  returnFocus: () => void
  onSyncNow?: () => void
}

/**
 * The detail behind the footer: when it last worked, what is waiting, and what
 * has been happening.
 *
 * It hangs above the footer and out past the sidebar's 232px, because the
 * questions it answers need sentences and the column does not have room for
 * one. Neither the sidebar nor its footer clips, so this needs no portal —
 * which is as well, since the app has none.
 *
 * The order is the order of the questions someone actually opens this to ask:
 * is it working, when did it last work, what have I got riding on it, and can
 * I make it go now. The log is last because it is the only part that is
 * history rather than status — but it is here at all because resolved
 * conflicts leave no other trace once their notices are dismissed.
 */
export function SyncPopover({
  snapshot,
  now,
  onClose,
  returnFocus,
  onSyncNow
}: SyncPopoverProps): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (event: MouseEvent): void => {
      if (!wrap.current?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      /* Escape is a keyboard gesture, so it owes the keyboard a place to land.
         The app's other popovers close and drop focus on the body; this one is
         reached from a real control, so it hands focus back to it. */
      returnFocus()
      onClose()
    }

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    wrap.current?.focus()

    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, returnFocus])

  const tone = syncTones[snapshot.state]
  const waiting = pendingTotal(snapshot.pending)
  const lines = pendingLines(snapshot.pending)
  const reason = snapshot.failure ? failureReasons[snapshot.failure] : null

  return (
    <div
      className="sync-pop"
      ref={wrap}
      role="dialog"
      aria-label="Sync detail"
      tabIndex={-1}
    >
      <div className="sync-pop__head">
        <div
          className={snapshot.state === 'syncing' ? 'dot pulse' : 'dot'}
          style={{ background: toneVar[tone] }}
          aria-hidden="true"
        />
        <span className="sync-pop__state">{reason ? reason.line : footerLabel(snapshot)}</span>
      </div>

      {/* The reason sits under the state rather than beside it: it is a
          sentence, and a sentence on the same line as a label reads as a
          subtitle instead of as the answer. */}
      {reason && <p className="sync-pop__reason">{reason.hint}</p>}

      <div className="sync-pop__rule" />

      <div className="sync-pop__fact">
        <span className="sync-pop__fact-label">Last synced</span>
        <span className="sync-pop__fact-value">
          {snapshot.lastSyncedAt === null ? 'Never' : agoLabel(snapshot.lastSyncedAt, now)}
        </span>
        {snapshot.lastSyncedAt !== null && (
          <span className="sync-pop__fact-clock num">{clockOf(snapshot.lastSyncedAt)}</span>
        )}
      </div>

      <div className="sync-pop__rule" />

      <div className="sync-pop__section">
        <span className="t-overline sync-pop__title">Waiting to upload</span>

        {waiting === 0 ? (
          /* Never a nought. The app writes absence as words or an em dash
             everywhere else, and "0 changes" reads as a broken counter. */
          <p className="sync-pop__empty">Nothing waiting.</p>
        ) : (
          <ul className="sync-pop__pending">
            {lines.map((line) => (
              <li className="sync-pop__pending-row" key={line.kind}>
                <span className="sync-pop__pending-count num">{line.count}</span>
                <span className="sync-pop__pending-label">{line.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="button sync-pop__action"
        disabled={snapshot.state === 'syncing'}
        onClick={onSyncNow}
      >
        <Icon name="sync" size={13} />
        {snapshot.state === 'syncing' ? 'Syncing…' : 'Sync now'}
      </button>

      <div className="sync-pop__rule" />

      <div className="sync-pop__section">
        <span className="t-overline sync-pop__title">Recent activity</span>

        {/* The project rail's timeline, reused: mark, label, date. */}
        <ol className="rail__history sync-pop__log">
          {snapshot.log.slice(0, 5).map((entry) => (
            <li className="rail__event" key={entry.id}>
              {/* A conflict is drawn no louder than a sync: by the time it
                  reaches this list it has been resolved, so the colour is a
                  way to find it again, not a warning. */}
              <span
                className="rail__event-mark"
                style={
                  entry.kind === 'synced'
                    ? undefined
                    : {
                        background: toneVar[entry.kind === 'conflict' ? 'warning' : 'negative'],
                        borderColor: toneVar[entry.kind === 'conflict' ? 'warning' : 'negative']
                      }
                }
                aria-hidden="true"
              />
              <span className="rail__event-label">{entry.detail}</span>
              <span className="rail__event-date num">{agoLabel(entry.at, now)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
