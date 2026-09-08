import type { JSX } from 'react'
import { Notice } from './Notice'

/**
 * The two shapes an update offer takes. `ready` is the common one: the build
 * is downloaded and a restart installs it. `available` is macOS, where an
 * unsigned build cannot be swapped in place, so the offer is the download.
 */
export type UpdateOffer = { kind: 'ready' | 'available'; version: string }

type UpdateNoticeProps = {
  offer: UpdateOffer
  /** Restart into the new build, or open its download page. */
  onInstall: () => void
  onDismiss: () => void
}

/**
 * The update is already downloaded; all that is left is the restart.
 *
 * Which is why this is an offer and not a warning: nothing is wrong, nothing
 * expires, and the app works exactly as well if it is ignored for a week. It
 * takes accent because accent is the app's colour for the one action worth
 * taking on a screen, and dismisses to nothing because "Later" has to mean
 * later and not "ask me again in ten minutes" — a dismissed version stays
 * dismissed until a newer one turns up.
 *
 * The sentence about the timer is the whole point of the notice. The single
 * reason anyone hesitates over restarting a time tracker is the fear of losing
 * a running session, so the answer comes before the button rather than after
 * someone has worked up the nerve to press it. And the answer is the true
 * one: a quit stops and logs the clock (main/index.ts, before-quit), which is
 * what "nothing is lost" means here, not that the clock keeps running through
 * the restart.
 *
 * Wired through LedgerApi.updates; the status behind it comes from
 * electron-updater in the main process.
 */
export function UpdateNotice({ offer, onInstall, onDismiss }: UpdateNoticeProps): JSX.Element {
  const ready = offer.kind === 'ready'
  return (
    <Notice
      tone="accent"
      icon="update"
      title={ready ? `Version ${offer.version} is ready` : `Version ${offer.version} is available`}
      onDismiss={onDismiss}
      actions={
        <>
          <button type="button" className="button button--primary notice__button" onClick={onInstall}>
            {ready ? 'Restart now' : 'Download'}
          </button>
          <button type="button" className="button notice__button" onClick={onDismiss}>
            Later
          </button>
        </>
      }
    >
      {ready
        ? 'Trackit restarts to finish installing, which takes about five seconds. A running timer is stopped and logged first, so nothing is lost.'
        : 'This build cannot replace itself on macOS. Download the new version and drop it over the old one; your projects, hours and invoices stay where they are.'}
    </Notice>
  )
}
