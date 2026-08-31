import type { JSX, ReactNode } from 'react'
import { tintVars, type Tone } from './tone'

type PillProps = {
  children: ReactNode
  tone?: Tone
  /** sm — list markers and metadata chips. md — status columns. */
  size?: 'sm' | 'md'
}

/**
 * The chip used for statuses (Active / Delivered / Paid / Sent / Archived),
 * late markers, and the client's currency and payment-terms metadata.
 */
export function Pill({ children, tone = 'neutral', size = 'sm' }: PillProps): JSX.Element {
  return (
    <span className={size === 'md' ? 'pill pill--md' : 'pill'} style={tintVars[tone]}>
      {children}
    </span>
  )
}
