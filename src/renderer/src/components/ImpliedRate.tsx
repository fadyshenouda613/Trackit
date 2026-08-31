import type { JSX } from 'react'
import { toneVar } from './tone'

/** The rate floor the app judges every project against. */
const RATE_FLOOR = 100

const money = (value: number): string =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Strips the grouping commas the price field is typed with. */
const parseNumber = (raw: string): number | null => {
  const cleaned = raw.replace(/,/g, '').trim()
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

type ImpliedRateProps = {
  price: string
  hours: string
}

/**
 * "If you hit that budget" — the fixed fee divided by the estimated hours,
 * judged against the rate floor. The artboard is captioned "implied rate
 * previews live", so this recalculates as the two fields are typed.
 */
export function ImpliedRate({ price, hours }: ImpliedRateProps): JSX.Element {
  const priceValue = parseNumber(price)
  const hoursValue = parseNumber(hours)
  const rate =
    priceValue !== null && hoursValue !== null && hoursValue > 0 ? priceValue / hoursValue : null

  const percent = rate === null ? null : Math.round((rate / RATE_FLOOR - 1) * 100)
  const tone = rate === null ? 'neutral' : rate >= RATE_FLOOR ? 'positive' : 'negative'

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
            ? `Floor ${money(RATE_FLOOR)}`
            : `${percent >= 0 ? '+' : '−'}${Math.abs(percent)}% vs ${money(RATE_FLOOR)} floor`}
        </span>
      </div>
    </div>
  )
}
