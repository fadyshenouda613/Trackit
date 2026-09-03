import { useState, type JSX } from 'react'
import { Notice } from './Notice'

/*
 * The two ways two machines can disagree, and what the app says about each.
 *
 * Both have already been resolved by the time you read them. Nothing here asks
 * you to choose — a dialog demanding you arbitrate a merge before you can get
 * to your invoices would be a far worse interruption than the conflict itself.
 * The app picks, says plainly what it picked, and leaves the other version
 * within reach for as long as the notice is up.
 *
 * They differ in register on purpose. A record edited twice may have lost you
 * something and is worth a look, so it is warm and carries a mark. A checklist
 * reordered twice lost nothing at all — both orders were kept where they
 * agreed — so it is grey and carries none. The app already makes this
 * distinction: "Information, not a warning" is why the timer recovery dialog
 * has no tint either.
 */

type ConflictNoticeProps = {
  onDismiss: () => void
}

/**
 * The same project, edited here and on another machine. One version had to
 * win; this one did, because it is the one you are looking at and the one you
 * would be most surprised to see change under you.
 */
export function RecordConflictNotice({ onDismiss }: ConflictNoticeProps): JSX.Element {
  const [confirming, setConfirming] = useState(false)

  return (
    <Notice
      tone="warning"
      icon="alert"
      title="Edited on two devices"
      onDismiss={onDismiss}
      actions={
        confirming ? (
          /* Two taps, not a dialog — the app's rule for anything that throws
             work away. Replacing what is on screen with a version you have not
             read is worth a pause, but not worth a second window on top of the
             one you are already reading. */
          <div className="inv-acts__confirm">
            <span className="inv-acts__confirm-text">
              This machine&rsquo;s edits from the last 3 hours would be replaced.
            </span>
            <div className="inv-acts__confirm-row">
              <button
                type="button"
                className="button inv-acts__button"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button inv-acts__button inv-acts__button--danger"
                onClick={() => {
                  setConfirming(false)
                  onDismiss()
                }}
              >
                Replace with the other version
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Inert: showing the difference needs both versions, and only one
                of them exists on this machine. */}
            <button type="button" className="button notice__button">
              Review changes
            </button>
            <button
              type="button"
              className="button notice__button"
              onClick={() => setConfirming(true)}
            >
              Use the other version
            </button>
          </>
        )
      }
    >
      The price and the due date changed here and on Studio iMac while this machine was
      offline. This machine&rsquo;s version was kept.
    </Notice>
  )
}

/**
 * The same checklist, reordered in two places. Nothing was lost and nothing
 * needs deciding, so this states what happened and offers the one thing you
 * might still want — your own order back.
 */
export function ReorderConflictNotice({ onDismiss }: ConflictNoticeProps): JSX.Element {
  return (
    <Notice
      title="Reordered in two places"
      onDismiss={onDismiss}
      actions={
        /* Inert: the order before the merge is not kept anywhere yet. */
        <button type="button" className="button notice__button">
          Undo the merge
        </button>
      }
    >
      You moved items here while Studio iMac moved others. Both orders were kept where they
      agreed, and this machine&rsquo;s won for the four items where they did not.
    </Notice>
  )
}
