import type { JSX } from 'react'
import type { Settings } from '@trackit/shared'
import { useAuthStatus } from '../data/use-auth'
import { SettingsRow, SettingsSection } from './SettingsRow'
import { agoLabel } from './time-data'
import { failureReasons, footerLabel, pendingTotal, syncTones, type SyncSnapshot } from './sync-data'
import { toneVar } from './tone'
import { useNow } from './use-now'

type SettingsAccountProps = {
  settings: Settings
  sync: SyncSnapshot
  onSyncNow: () => void
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
  sync: snapshot,
  onSyncNow,
  onSignOut
}: SettingsAccountProps): JSX.Element {
  const now = useNow()
  const pending = pendingTotal(snapshot.pending)
  const reason = snapshot.failure ? failureReasons[snapshot.failure] : null

  /*
   * The session as the main process holds it. Expired means the server no
   * longer honours this machine's token: syncing stops until someone signs
   * in again, and nothing else does — every screen behind this one reads
   * and writes the local database exactly as before.
   */
  const auth = useAuthStatus().data
  const signedIn = auth?.state === 'signedIn' ? auth : null
  const expired = signedIn?.session === 'expired'
  const sessionHint = expired
    ? 'Your session has expired. Sign in again to sync; your work here is unaffected.'
    : signedIn
      ? 'Signed in on this machine. Syncing uses this account.'
      : 'Not signed in. Your work stays on this machine until you are.'

  return (
    <SettingsSection
      title="Account and sync"
      note="Your work is kept on this machine first and copied up when there is a connection."
    >
      <div className="settings-facts">
        <div className="settings-facts__cell">
          <span className="t-overline settings-facts__label">Signed in as</span>
          <span className="settings-facts__value">
            {signedIn?.user.email ?? (settings.accountEmail || 'Nobody')}
          </span>
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
            style={{ color: toneVar[syncTones[snapshot.state]] }}
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
        {/* Refused while one runs, and on the one ground the engine would
            refuse it too: an expired session has no token to sync with. */}
        <button
          type="button"
          className="button"
          disabled={snapshot.state === 'syncing' || expired}
          onClick={onSyncNow}
        >
          {snapshot.state === 'syncing' ? 'Syncing…' : 'Sync now'}
        </button>
      </SettingsRow>

      <SettingsRow label="Session" hint={sessionHint}>
        {/* Signing in again is signing out and back in; the button says the
            half that matters. Otherwise the row is a fact, and has no control. */}
        {expired ? (
          <button type="button" className="button" onClick={onSignOut}>
            Sign in again
          </button>
        ) : (
          <span className="settings-facts__value">{signedIn ? 'Active' : 'None'}</span>
        )}
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
