import type { JSX, ReactNode } from 'react'

type EmptyAction = {
  label: string
  /** The shortcut that does the same thing, shown beside a screen CTA. */
  kbd?: string
  onClick?: () => void
}

type EmptyStateProps = {
  /**
   * screen — the whole window has nothing in it: centred, 380px, with the
   * accent mark and a filled button.
   * panel — one section of a full screen is empty. It sits inside the panel
   * above whatever footer or totals row the panel still has, so the table's
   * own shape survives the absence.
   */
  variant?: 'screen' | 'panel'
  title: string
  body: ReactNode
  action?: EmptyAction
  /** The quieter second option, when there is one. */
  aside?: ReactNode
}

/**
 * What a screen says when there is nothing to show.
 *
 * There were five of these, written one at a time as each screen was built:
 * the full-window one for a new account, and four in-panel ones for filters
 * that matched nothing, a client with nothing delivered, an invoice with no
 * payments, and a project with no invoice. They had drifted — different
 * paddings, different body widths, two of them bolding the title and two not.
 *
 * They are one component now with two variants, because an empty state is
 * always the same three moves: say what is not here, say why in a sentence
 * that assumes nothing went wrong, and offer the one thing that would fill it.
 * The variants differ only in scale, since the difference between them is how
 * much of the window is empty, not what the emptiness means.
 */
export function EmptyState({
  variant = 'screen',
  title,
  body,
  action,
  aside
}: EmptyStateProps): JSX.Element {
  if (variant === 'panel') {
    return (
      <div className="empty empty--panel">
        <p className="empty__title">{title}</p>
        <p className="empty__body t-body">{body}</p>
        {(action || aside) && (
          <div className="empty__actions">
            {action && (
              <button type="button" className="empty__link" onClick={action.onClick}>
                {action.label}
              </button>
            )}
            {aside && <span className="empty__aside">{aside}</span>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="empty">
      <div className="empty__inner">
        <div className="empty__mark" />
        <h2 className="t-title">{title}</h2>
        <p className="t-body empty__body">{body}</p>
        {(action || aside) && (
          <div className="empty__actions">
            {action && (
              <button type="button" className="empty__cta" onClick={action.onClick}>
                {action.label}
                {action.kbd && <span className="empty__kbd">{action.kbd}</span>}
              </button>
            )}
            {aside && <span className="empty__aside">{aside}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
