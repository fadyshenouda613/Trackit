import type { JSX } from 'react'
import { toneVar, type Tone } from './Meter'

/** The three sidebar footer states the design system specifies. */
export type SyncState = 'saved' | 'syncing' | 'offline'

const states: Record<SyncState, { label: string; time: string; tone: Tone }> = {
  saved: { label: 'All changes saved', time: '14:02', tone: 'positive' },
  // Tones for these two aren't specified; accent reads as activity, warning as degraded.
  syncing: { label: 'Syncing 3 changes', time: 'now', tone: 'neutral' },
  offline: { label: 'Offline — 8 pending', time: '2h ago', tone: 'warning' }
}

type SyncStatusProps = {
  state: SyncState
  /** The empty screen shows "Saved on this Mac" with no timestamp. */
  label?: string
  time?: string | null
}

export function SyncStatus({ state, label, time }: SyncStatusProps): JSX.Element {
  const preset = states[state]
  const shownTime = time === undefined ? preset.time : time
  const background = state === 'syncing' ? 'var(--accent)' : toneVar[preset.tone]

  return (
    <div className="sync">
      <div
        className={state === 'syncing' ? 'dot pulse' : 'dot'}
        style={{ background }}
        aria-hidden="true"
      />
      <span className="sync__text">{label ?? preset.label}</span>
      <div className="spacer" />
      {shownTime !== null && <span className="sync__time">{shownTime}</span>}
    </div>
  )
}
