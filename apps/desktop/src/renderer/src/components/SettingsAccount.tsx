import type { JSX } from 'react'
import { SettingsRow, SettingsSection } from './SettingsRow'
import { agoLabel } from './time-data'
import { failureReasons, footerLabel, pendingTotal, snapshots, type SyncState } from './sync-data'
import { syncTones } from './sync-data'
import type { Settings } from './settings-data'
import { toneVar } from './tone'
import { useNow } from './use-now'

type SettingsAccountProps = {
  settings: Settings
  syncState: SyncState
  onSignOut: () => void
}

/**
 * Read-only, because none of it is a preference — it is what is true right now.
 *
 * The figures come from the same snapshot the sidebar footer reads, so the two
 * can never disagree about when you last synced or how much is waiting. This
 * section used to keep its own little table of pending counts beside the
 * footer's, which is exactly the arrangement that lets two screens quietly
 * start telling you different numbers.
 */
export function SettingsAccount({
  settings,
  syncState,
  onSignOut
}: SettingsAccountProps): JSX.Element {
  const now = useNow()
  const snapshot = snapshots[syncState]
  const pending = pendingTotal(snapshot.pending)
  const reason = snapshot.failure ? failureReasons[snapshot.failure] : null

  return (
    <SettingsSection
      title="Account and sync"
      note="Your work is kept on this machine first and copied up when there is a connection."
    >
      <div className="settings-facts">
        <div className="settings-facts__cell">
          <span className="t-overline settings-facts__label">Signed in as</span>
          <span className="settings-facts__value">{settings.accountEmail}</span>
        </div>

        <div className="settings-facts__cell">
          <span className="t-overline settings-facts__label">Last synced</span>
          <span className="settings-facts__value">
            {snapshot.lastSyncedAt === null ? 'Never' : agoLabel(snapshot.lastSyncedAt, now)}
          </span>
        </div>

        <div className="settings-facts__cell">
          <span className="t-overline settings-facts__label">Pending changes</span>
          <span
            className="settings-facts__value num"
            style={{ color: toneVar[syncTones[syncState]] }}
          >
            {pending === 0 ? 'None' : pending}
          </span>
        </div>
      </div>

      <SettingsRow
        label="Sync"
        /* When it has failed, the reason is the only thing worth saying here —
           the state alone ("Could not sync") is what you already knew. */
        hint={reason ? reason.hint : footerLabel(snapshot)}
      >
        {/* Inert: syncing needs a service, and there is none behind this yet. */}
        <button type="button" className="button" disabled={syncState === 'syncing'}>
          Sync now
        </button>
      </SettingsRow>

      <SettingsRow
        label="Sign out"
        hint="Your data stays on this machine. Signing back in picks it up where it is."
      >
        {/* A plain button, not a destructive one: nothing is lost by signing out. */}
        <button type="button" className="button" onClick={onSignOut}>
          Sign out
        </button>
      </SettingsRow>
    </SettingsSection>
  )
}
