import { useEffect, useRef, useState, type JSX } from 'react'
import { Icon } from './Icon'
import { toneVar } from './tone'
import type { Toast } from './toast-data'

/** Long enough to read fifteen words twice, short enough not to sit there. */
const LIFETIME = 5000

/** Three is the point at which a stack stops being glanceable and starts being a list. */
const MAX = 3

type ToastCardProps = {
  toast: Toast
  onDismiss: (id: number) => void
}

function ToastCard({ toast, onDismiss }: ToastCardProps): JSX.Element {
  const [held, setHold] = useState(false)

  useEffect(() => {
    /* Held while the pointer or the keyboard is inside it. Someone who has
       moved to a toast is reading it or about to press its action, and pulling
       it out from under them is the one way a toast can actually cost you
       something. */
    if (held) return
    const id = setTimeout(() => onDismiss(toast.id), LIFETIME)
    return () => clearTimeout(id)
  }, [held, toast.id, onDismiss])

  return (
    <div
      className="toast"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
    >
      <div className="dot" style={{ background: toneVar[toast.tone] }} aria-hidden="true" />

      <span className="toast__text">{toast.message}</span>

      {/* Inert: every one of these needs something the app does not have yet —
          a file manager, a register write, a timer to put back. */}
      {toast.action && (
        <button type="button" className="toast__action">
          {toast.action}
        </button>
      )}

      <button
        type="button"
        className="toast__close"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
      >
        <Icon name="close" size={11} />
      </button>
    </div>
  )
}

type ToastStackProps = {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

/**
 * Where the app says a thing worked.
 *
 * Top-centre and inside `.main` rather than over the whole window, which means
 * it clears the 232px sidebar and sits below the timer bar without any
 * arithmetic against --timer-bar-height: the bar is a sibling of this layer's
 * ancestor, so it simply cannot be covered.
 *
 * It sits under the scrim in the z-order on purpose. A dialog is one question
 * being asked of you, and news about something that already finished has no
 * business on top of it.
 *
 * The layer is always mounted, never conditional. A live region has to be in
 * the document before its content arrives or a screen reader has nothing to
 * watch and announces none of this.
 */
export function ToastStack({ toasts, onDismiss }: ToastStackProps): JSX.Element {
  const shown = toasts.slice(-MAX)

  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {shown.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

/**
 * Owns the queue. Kept here rather than in App so the cap, the ordering and
 * the dismissal live next to the component that shows them.
 */
export function useToasts(): {
  toasts: Toast[]
  push: (toast: Toast) => void
  dismiss: (id: number) => void
} {
  const [toasts, setToasts] = useState<Toast[]>([])
  /* Identity has to be stable: it is a dependency of every card's timeout, and
     a new function each render would restart all of them on every keystroke. */
  const dismiss = useRef((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }).current

  const push = useRef((toast: Toast) => {
    setToasts((current) => [...current, toast].slice(-MAX))
  }).current

  return { toasts, push, dismiss }
}
