import type { JSX } from 'react'
import { Icon } from './Icon'
import { formatDelta, formatDuration, weekRangeLabel } from './time-data'

type WeekToolbarProps = {
  offset: number
  start: string
  totalMinutes: number
  previousMinutes: number
  onOffset: (offset: number) => void
}

/**
 * The header's second tier — the week you are looking at on the left, what it
 * came to on the right.
 *
 * The comparison stays neutral. The design system keeps colour for money
 * moving, and logging four hours more than last week is a fact about a week,
 * not a number anyone owes: the caret carries the direction on its own.
 */
export function WeekToolbar({
  offset,
  start,
  totalMinutes,
  previousMinutes,
  onOffset
}: WeekToolbarProps): JSX.Element {
  return (
    <div className="week-bar">
      <div className="week-bar__nav">
        <button
          type="button"
          className="week-bar__arrow"
          aria-label="Previous week"
          onClick={() => onOffset(offset - 1)}
        >
          <Icon name="chevron" size={12} className="week-bar__arrow-glyph--back" />
        </button>
        <button
          type="button"
          className="week-bar__arrow"
          aria-label="Next week"
          disabled={offset >= 0}
          onClick={() => onOffset(offset + 1)}
        >
          <Icon name="chevron" size={12} />
        </button>
      </div>

      <span className="week-bar__range num">{weekRangeLabel(start)}</span>

      <button
        type="button"
        className="button"
        disabled={offset === 0}
        onClick={() => onOffset(0)}
      >
        This week
      </button>

      <div className="spacer" />

      <span className="t-overline week-bar__total-label">Logged</span>
      <span className="week-bar__total-value num">{formatDuration(totalMinutes)}</span>
      <span className="week-bar__delta num">{formatDelta(totalMinutes, previousMinutes)}</span>
    </div>
  )
}
