import { describe, expect, it } from 'vitest'
import {
  SORT_ORDER_STEP,
  bySortOrder,
  rebalanceSortOrders,
  sortOrderBetween,
  sortOrderForAppend,
  sortOrderForMove,
  sortOrdersAreCrowded,
  withMove
} from './sort-order'

const list = [
  { id: 'a', sortOrder: 1 },
  { id: 'b', sortOrder: 2 },
  { id: 'c', sortOrder: 3 }
]

describe('sortOrderBetween', () => {
  it('is the midpoint of two neighbours', () => {
    expect(sortOrderBetween(1, 2)).toBe(1.5)
    expect(sortOrderBetween(1.5, 2)).toBe(1.75)
    expect(sortOrderBetween(-2, 2)).toBe(0)
  })

  it('steps outward at either end and starts an empty list', () => {
    expect(sortOrderBetween(null, 5)).toBe(5 - SORT_ORDER_STEP)
    expect(sortOrderBetween(5, null)).toBe(5 + SORT_ORDER_STEP)
    expect(sortOrderBetween(null, null)).toBe(SORT_ORDER_STEP)
  })

  it('refuses neighbours in the wrong order', () => {
    expect(() => sortOrderBetween(2, 1)).toThrow(RangeError)
    expect(() => sortOrderBetween(1, 1)).toThrow(RangeError)
  })

  it('keeps the moved row strictly between its neighbours across many moves', () => {
    let before = 1
    const after = 2
    for (let i = 0; i < 40; i += 1) {
      const next = sortOrderBetween(before, after)
      expect(next).toBeGreaterThan(before)
      expect(next).toBeLessThan(after)
      before = next
    }
  })
})

describe('sortOrdersAreCrowded', () => {
  it('is false with room to spare and true once the floats run out', () => {
    expect(sortOrdersAreCrowded(1, 2)).toBe(false)
    expect(sortOrdersAreCrowded(1, 1 + Number.EPSILON)).toBe(true)
  })

  it('is reached by repeatedly moving into the same slot', () => {
    let before = 1
    const after = 2
    let crowded = false
    for (let i = 0; i < 80 && !crowded; i += 1) {
      crowded = sortOrdersAreCrowded(before, after)
      if (!crowded) before = sortOrderBetween(before, after)
    }
    expect(crowded).toBe(true)
  })
})

describe('sortOrderForAppend', () => {
  it('goes one step past the last row, or starts the list', () => {
    expect(sortOrderForAppend(list)).toBe(3 + SORT_ORDER_STEP)
    expect(sortOrderForAppend([{ sortOrder: 0.5 }, { sortOrder: 7.25 }])).toBe(7.25 + SORT_ORDER_STEP)
    expect(sortOrderForAppend([])).toBe(SORT_ORDER_STEP)
  })
})

describe('bySortOrder', () => {
  it('sorts ascending and breaks ties by id so two machines agree', () => {
    const rows = [
      { id: 'z', sortOrder: 2 },
      { id: 'b', sortOrder: 1 },
      { id: 'a', sortOrder: 1 }
    ]
    expect([...rows].sort(bySortOrder).map((row) => row.id)).toEqual(['a', 'b', 'z'])
  })
})

describe('sortOrderForMove', () => {
  it('lands the row directly above the one it was dropped on', () => {
    expect(sortOrderForMove(list, 'c', 'a')).toBe(1 - SORT_ORDER_STEP)
    expect(sortOrderForMove(list, 'a', 'c')).toBe(2.5)
    expect(sortOrderForMove(list, 'c', 'b')).toBe(1.5)
  })

  it('ignores the order the rows were handed in', () => {
    expect(sortOrderForMove([...list].reverse(), 'a', 'c')).toBe(2.5)
  })

  it('is null when there is nothing to do', () => {
    expect(sortOrderForMove(list, 'a', 'a')).toBeNull()
    expect(sortOrderForMove(list, 'missing', 'a')).toBeNull()
    expect(sortOrderForMove(list, 'a', 'missing')).toBeNull()
  })
})

describe('rebalanceSortOrders', () => {
  it('respaces the rows one step apart in their current order', () => {
    const crowded = [
      { id: 'c', sortOrder: 0.5 },
      { id: 'a', sortOrder: 0.25 },
      { id: 'b', sortOrder: 0.75 }
    ]
    expect(rebalanceSortOrders(crowded)).toEqual([
      { id: 'a', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
      { id: 'b', sortOrder: 3 }
    ])
    expect(crowded[0]).toEqual({ id: 'c', sortOrder: 0.5 })
  })
})

describe('withMove', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('moves a row to sit directly above another', () => {
    expect(withMove(items, 'c', 'a').map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(withMove(items, 'a', 'c').map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })

  it('returns the same list when there is nothing to do', () => {
    expect(withMove(items, 'a', 'a')).toBe(items)
    expect(withMove(items, 'missing', 'a')).toBe(items)
    expect(withMove(items, 'a', 'missing')).toBe(items)
  })

  it('never mutates the source', () => {
    withMove(items, 'c', 'a')
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
})
