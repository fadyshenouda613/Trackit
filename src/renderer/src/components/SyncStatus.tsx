import type { JSX, Ref } from 'react'
import { agoShort } from './time-data'
import { footerLabel, syncTones, type SyncSnapshot } from './sync-data'
import { toneVar } from './tone'

type SyncStatusProps = {
  snapshot: SyncSnapshot
  /** The empty screen shows "Saved on this Mac" with no timestamp. */
  label?: string
  time?: string | null
  /** Passed by the caller so the popover can measure and re-focus the trigger. */
  buttonRef?: Ref<HTMLButtonElement>
  open?: boolean
  onToggle?: () => void
  /** Re-read on a tick by the parent, so 'now' becomes '4m' on its own. */
  now?: number
}

/**
 * The sidebar footer: a dot, a sentence, and how long ago it was true.
 *
 * It is a button now. It always had a hover background, which promised a click
 * it could not deliver; there is something behind it at last, so the element
 * says so rather than only looking like it.
 *
 * The dot is the whole state in six pixels — the one thing readable from
 * across the room — and the sentence is what it means. Both come from the
 * snapshot rather than from a table of strings, so the count in the footer and
 * the breakdown in the popover are the same number counted once.
 */
export function SyncStatus({
  snapshot,
  label,
  time,
  buttonRef,
  open = false,
  onToggle,
  now
}: SyncStatusProps): JSX.Element {
  const tone = syncTones[snapshot.state]
  const syncing = snapshot.state === 'syncing'
  const shownTime =
    time === undefined ? (syncing ? 'now' : agoShort(snapshot.lastSyncedAt, now)) : time

  return (
    <button
      type="button"
      className={open ? 'sync sync--open' : 'sync'}
      ref={buttonRef}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onToggle}
    >
      <div
        className={syncing ? 'dot pulse' : 'dot'}
        style={{ background: toneVar[tone] }}
        aria-hidden="true"
      />
      <span className="sync__text truncate">{label ?? footerLabel(snapshot)}</span>
      <div className="spacer" />
      {shownTime !== null && <span className="sync__time">{shownTime}</span>}
    </button>
  )
}
