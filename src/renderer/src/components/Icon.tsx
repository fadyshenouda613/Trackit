import type { JSX } from 'react'

/** The icon set used by the artboard, drawn on a 16x16 grid at 1.3-1.4 stroke. */
export type IconName =
  | 'search'
  | 'dashboard'
  | 'clients'
  | 'projects'
  | 'time'
  | 'invoices'
  | 'settings'
  | 'chevron'
  | 'close'
  | 'caret'
  | 'more'
  | 'grip'
  | 'check'
  | 'plus'
  | 'play'
  | 'trash'

const paths: Record<IconName, JSX.Element> = {
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  dashboard: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  clients: (
    <>
      <circle cx="8" cy="5.5" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 13.5c0-2.4 2.2-3.8 5-3.8s5 1.4 5 3.8" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  projects: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="5" y1="6.5" x2="11" y2="6.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="5" y1="9.5" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  time: (
    <>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3.2l2.2 1.6" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  invoices: (
    <>
      <rect x="3.5" y="2" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="6" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="6" y1="8.5" x2="10" y2="8.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="6" y1="11" x2="8" y2="11" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.3" />
      <circle
        cx="8"
        cy="8"
        r="5.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeDasharray="2.2 2.6"
      />
    </>
  ),
  chevron: <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.4" />,
  close: (
    <>
      <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  caret: <path d="M4 6.5L8 10.5L12 6.5" stroke="currentColor" strokeWidth="1.4" />,
  more: (
    <>
      <circle cx="3.5" cy="8" r="1.35" fill="currentColor" />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.35" fill="currentColor" />
    </>
  ),
  grip: (
    <>
      <circle cx="6" cy="3.5" r="1.1" fill="currentColor" />
      <circle cx="10" cy="3.5" r="1.1" fill="currentColor" />
      <circle cx="6" cy="8" r="1.1" fill="currentColor" />
      <circle cx="10" cy="8" r="1.1" fill="currentColor" />
      <circle cx="6" cy="12.5" r="1.1" fill="currentColor" />
      <circle cx="10" cy="12.5" r="1.1" fill="currentColor" />
    </>
  ),
  check: (
    <path
      d="M3.5 8.4L6.5 11.4L12.5 4.9"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  plus: (
    <>
      <line x1="8" y1="3.5" x2="8" y2="12.5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="3.5" y1="8" x2="12.5" y2="8" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  /* Solid, unlike the rest: it sits inside a filled button, where a 1.3 stroke
     at this size would disappear against the accent. */
  play: <path d="M5.5 3.6L12 8L5.5 12.4Z" fill="currentColor" />,
  trash: (
    <>
      <path d="M3.5 4.5h9" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.3 4.5V3.2h3.4v1.3" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M4.8 4.5l.6 8a.9.9 0 00.9.8h3.4a.9.9 0 00.9-.8l.6-8"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </>
  )
}

type IconProps = {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 15, className }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  )
}
