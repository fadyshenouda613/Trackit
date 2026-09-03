import type { JSX, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { noticeAccentVar, noticeVars, type Tone } from './tone'

type NoticeProps = {
  /**
   * neutral is information — something happened and it has already been dealt
   * with. warning is something worth a look. accent is an offer. Nothing here
   * is ever negative: a notice you can dismiss is by definition not a failure.
   */
  tone?: Tone
  icon?: IconName
  title: string
  /** The explanation. One or two sentences; it is prose, not a field. */
  children?: ReactNode
  actions?: ReactNode
  onDismiss?: () => void
}

/**
 * A dismissible strip that says something happened, without taking the screen.
 *
 * The invoice's void banner proved the shape — a tinted surface, a matching
 * edge, and body text a step dimmer than the mark — and this is that recipe
 * with the tone lifted out, because two more things need it: a conflict that
 * has already been resolved, and an update waiting to install. All three are
 * the same event in the end. Something changed outside this window, you did
 * not ask for it, and you should know but you should not be stopped.
 *
 * So: no scrim, no focus trap, and in the flow of the page rather than over
 * it. It pushes the content down, which is the honest thing — it is taking up
 * room, and pretending otherwise by floating over the top only means covering
 * something you were reading.
 */
export function Notice({
  tone = 'neutral',
  icon,
  title,
  children,
  actions,
  onDismiss
}: NoticeProps): JSX.Element {
  const mark = noticeAccentVar[tone]

  return (
    <div className="notice" style={noticeVars[tone]} role="status">
      {icon && (
        <span className="notice__mark" style={{ color: mark }} aria-hidden="true">
          <Icon name={icon} size={15} />
        </span>
      )}

      <div className="notice__text">
        <span className="notice__title" style={{ color: mark }}>
          {title}
        </span>
        {children && <p className="notice__body">{children}</p>}
        {actions && <div className="notice__actions">{actions}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          className="notice__close"
          aria-label={`Dismiss: ${title}`}
          onClick={onDismiss}
        >
          <Icon name="close" size={11} />
        </button>
      )}
    </div>
  )
}
