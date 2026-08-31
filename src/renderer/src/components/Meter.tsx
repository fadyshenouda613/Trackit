import type { JSX } from 'react'
import { toneVar, type TextTone, type Tone } from './tone'

export type { Tone, TextTone }
export { toneVar }

type MeterProps = {
  /** Percentage as shown. Over-budget values exceed 100 and clamp to a full bar. */
  value: number
  tone?: TextTone
  label?: string
}

/** The 3px progress rail used for both the checklist and the hour budget. */
export function Meter({ value, tone = 'neutral', label }: MeterProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div
      className="meter"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="meter__fill" style={{ width: `${clamped}%`, background: toneVar[tone] }} />
    </div>
  )
}
