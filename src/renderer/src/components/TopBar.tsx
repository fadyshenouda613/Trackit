import type { JSX, ReactNode } from 'react'
import { Icon } from './Icon'
import { TitleBarControls } from './TitleBarControls'

type TopBarProps = {
  /**
   * Omitted when the screen carries its own header — the bar then reduces to a
   * back crumb plus window chrome rather than naming the record twice.
   */
  title?: string
  /** Secondary text beside the title — a date, a count. */
  meta?: string
  /** A parent crumb rendered before the title, with a chevron. */
  breadcrumb?: { label: string; onClick: () => void }
  actions?: ReactNode
  /**
   * True when no timer bar sits above, which makes this the topmost bar: it
   * then owns the window drag region and the macOS traffic-light inset.
   */
  isTopmost?: boolean
}

/**
 * Every screen's 52px header. It is the single owner of the frameless-window
 * chrome, so each screen supplies its own content rather than its own bar.
 */
export function TopBar({
  title,
  meta,
  breadcrumb,
  actions,
  isTopmost = false
}: TopBarProps): JSX.Element {
  return (
    <div className={isTopmost ? 'top-bar drag' : 'top-bar'}>
      {breadcrumb &&
        (title ? (
          <>
            <button type="button" className="top-bar__crumb no-drag" onClick={breadcrumb.onClick}>
              {breadcrumb.label}
            </button>
            <Icon name="chevron" size={12} className="top-bar__crumb-chevron" />
          </>
        ) : (
          <button
            type="button"
            className="top-bar__crumb top-bar__crumb--back no-drag"
            onClick={breadcrumb.onClick}
          >
            <Icon name="chevron" size={12} className="top-bar__crumb-chevron-back" />
            {breadcrumb.label}
          </button>
        ))}

      {title && <h1 className="t-subhead">{title}</h1>}
      {meta && <span className="top-bar__date num">{meta}</span>}

      <div className="spacer" />

      {actions}

      {isTopmost && <TitleBarControls />}
    </div>
  )
}
