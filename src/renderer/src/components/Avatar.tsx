import type { JSX } from 'react'

type AvatarProps = {
  /** Two initials, as the artboard shows them. */
  initials: string
  /** sm — 24px in the clients list. lg — 44px on the client detail header. */
  size?: 'sm' | 'lg'
  /** The selected or current client takes the accent tint. */
  tone?: 'neutral' | 'accent'
}

export function Avatar({ initials, size = 'sm', tone = 'neutral' }: AvatarProps): JSX.Element {
  const className = [
    'avatar',
    size === 'lg' ? 'avatar--lg' : '',
    tone === 'accent' ? 'avatar--accent' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} aria-hidden="true">
      {initials}
    </div>
  )
}
