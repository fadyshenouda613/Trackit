import type { JSX } from 'react'
import { money, parseMoney } from './money'
import { toneVar } from './tone'

type ImpliedRateProps = {
  price: string
  hours: string
  /** The rate floor the app judges every project against, from Settings. */
  rateFloor: number
}

/**
 * "If you hit that budget" — the fixed fee divided by the estimated hours,
 * judged against the rate floor. The artboard is captioned "implied rate
 * previews live", so this recalculates as the two fields are typed.
 */
export function ImpliedRate({ price, hours, rateFloor }: ImpliedRateProps): JSX.Element {
  const priceValue = parseMoney(price)
  const hoursValue = parseMoney(hours)
  const rate =
    priceValue !== null && hoursValue !== null && hoursValue > 0 ? priceValue / hoursValue : null

  const percent = rate === null ? null : Math.round((rate / rateFloor - 1) * 100)
  const tone = rate === null ? 'neutral' : rate >= rateFloor ? 'positive' : 'negative'

  return (
    <div className="implied">
      <div className="implied__text">
        <span className="t-overline implied__label">If you hit that budget</span>
        <span className="implied__basis">
          {priceValue === null || hoursValue === null || hoursValue <= 0
            ? 'Enter a price and an hours budget to see your implied rate'
            : `${money(priceValue)} ÷ ${hoursValue}h — recalculated from real hours as you log them`}
        </span>
      </div>

      <div className="spacer" />

      <div className="implied__figure">
        <span className="implied__rate" style={{ color: toneVar[tone] }}>
          {rate === null ? '—' : money(rate)}
          {rate !== null && <span className="implied__unit">/hr</span>}
        </span>
        <span className="implied__note">
          {percent === null
            ? `Floor ${money(rateFloor)}`
            : `${percent >= 0 ? '+' : '−'}${Math.abs(percent)}% vs ${money(rateFloor)} floor`}
        </span>
      </div>
    </div>
  )
}
