import type { JSX } from 'react'
import { Notice } from './Notice'

type UpdateNoticeProps = {
  version: string
  onDismiss: () => void
}

/**
 * The update is already downloaded; all that is left is the restart.
 *
 * Which is why this is an offer and not a warning: nothing is wrong, nothing
 * expires, and the app works exactly as well if it is ignored for a week. It
 * takes accent because accent is the app's colour for the one action worth
 * taking on a screen, and dismisses to nothing because "Later" has to mean
 * later and not "ask me again in ten minutes".
 *
 * The sentence about the timer is the whole point of the notice. The single
 * reason anyone hesitates over restarting a time tracker is the fear of losing
 * a running session, so the answer comes before the button rather than after
 * someone has worked up the nerve to press it.
 *
 * Nothing is wired: there is no electron-updater in this app and no update IPC.
 * When there is, it belongs on LedgerApi in packages/shared/src/api.ts, with a matching
 * no-op in the detached stub in bridge.ts, like every other main-process call.
 */
export function UpdateNotice({ version, onDismiss }: UpdateNoticeProps): JSX.Element {
  return (
    <Notice
      tone="accent"
      icon="update"
      title={`Version ${version} is ready`}
      onDismiss={onDismiss}
      actions={
        <>
          {/* Inert: restarting into a new build needs autoUpdater over IPC. */}
          <button type="button" className="button button--primary notice__button">
            Restart now
          </button>
          <button type="button" className="button notice__button" onClick={onDismiss}>
            Later
          </button>
        </>
      }
    >
      Trackit restarts to finish installing, and takes about five seconds. A running timer
      keeps counting and anything you have typed is kept.
    </Notice>
  )
}
