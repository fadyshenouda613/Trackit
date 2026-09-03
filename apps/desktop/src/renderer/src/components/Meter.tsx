import type { CSSProperties, JSX } from 'react'
import { toneVar, type TextTone, type Tone } from './tone'

export type { Tone, TextTone }
export { toneVar }

type MeterProps = {
  /** Percentage as shown. Over-budget values exceed 100 and clamp to a full bar. */
  value: number
  /**
   * Omitted means "unjudged" — the fill falls back to --meter-fill, the one
   * neutral that reads as a proportion rather than as a piece of text.
   */
  tone?: TextTone
  label?: string
  /** lg — the 5px rail the project header and checklist summary use. */
  size?: 'sm' | 'lg'
}

/** The progress rail used for the checklist and the hour budget. */
export function Meter({ value, tone, label, size = 'sm' }: MeterProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value))
  const style: CSSProperties = { width: `${clamped}%` }
  if (tone) style.background = toneVar[tone]

  return (
    <div
      className={size === 'lg' ? 'meter meter--lg' : 'meter'}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="meter__fill" style={style} />
    </div>
  )
}
