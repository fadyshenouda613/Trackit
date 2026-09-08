import type { JSX } from 'react'
import {
  formatCents,
  impliedRateCents,
  parseMoney,
  parseMoneyToCents,
  rateVsFloorPercent
} from '@trackit/shared'
import { toneVar } from './tone'

type ImpliedRateProps = {
  price: string
  hours: string
  /** The rate floor the app judges every project against, from Settings, in cents. */
  rateFloorCents: number
}

/**
 * "If you hit that budget" — the fixed fee divided by the estimated hours,
 * judged against the rate floor. The artboard is captioned "implied rate
 * previews live", so this recalculates as the two fields are typed.
 */
export function ImpliedRate({ price, hours, rateFloorCents }: ImpliedRateProps): JSX.Element {
  const priceCents = parseMoneyToCents(price)
  const hoursValue = parseMoney(hours)
  const rate =
    priceCents !== null && hoursValue !== null && hoursValue > 0
      ? impliedRateCents(priceCents, hoursValue)
      : null

  const percent = rate === null ? null : rateVsFloorPercent(rate, rateFloorCents)
  const tone = rate === null ? 'neutral' : rate >= rateFloorCents ? 'positive' : 'negative'

  return (
    <div className="implied">
      <div className="implied__text">
        <span className="t-overline implied__label">If you hit that budget</span>
        <span className="implied__basis">
          {priceCents === null || hoursValue === null || hoursValue <= 0
            ? 'Enter a price and an hours budget to see your implied rate'
            : `${formatCents(priceCents)} ÷ ${hoursValue}h — recalculated from real hours as you log them`}
        </span>
      </div>

      <div className="spacer" />

      <div className="implied__figure">
        <span className="implied__rate" style={{ color: toneVar[tone] }}>
          {rate === null ? '—' : formatCents(rate)}
          {rate !== null && <span className="implied__unit">/hr</span>}
        </span>
        <span className="implied__note">
          {percent === null
            ? `Floor ${formatCents(rateFloorCents)}`
            : `${percent >= 0 ? '+' : '−'}${Math.abs(percent)}% vs ${formatCents(rateFloorCents)} floor`}
        </span>
      </div>
    </div>
  )
}
