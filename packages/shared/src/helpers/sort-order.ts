/**
 * Fractional ordering.
 *
 * Every ordered row carries a float `sortOrder`. Moving a row gives it the
 * midpoint of its new neighbours, so a drag writes one row and syncs one
 * change rather than renumbering the list — two machines reordering the same
 * list offline then merge as two rows moved, not two whole orders.
 *
 * Midpoints halve the gap each time. After enough moves into the same slot
 * the floats run out of room; `sortOrdersAreCrowded` says when, and
 * `rebalanceSortOrders` spaces the list out again.
 */

/** The gap between rows in a fresh or rebalanced list. */
export const SORT_ORDER_STEP = 1

/**
 * A position between two neighbours. Either side may be absent: before the
 * first row, after the last, or into an empty list.
 */
export function sortOrderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return SORT_ORDER_STEP
  if (before === null) return (after as number) - SORT_ORDER_STEP
  if (after === null) return before + SORT_ORDER_STEP
  if (before >= after) {
    throw new RangeError(`sortOrderBetween: before (${before}) must be less than after (${after})`)
  }
  return before + (after - before) / 2
}

/** True when the floats between two neighbours can no longer hold a midpoint. */
export function sortOrdersAreCrowded(before: number, after: number): boolean {
  const between = before + (after - before) / 2
  return !(between > before && between < after)
}

/** The position for a row appended to the end of a list. */
export const sortOrderForAppend = (items: { sortOrder: number }[]): number =>
  items.length === 0 ? SORT_ORDER_STEP : Math.max(...items.map((item) => item.sortOrder)) + SORT_ORDER_STEP

/** Ascending by sortOrder, ties broken by id so two machines agree. */
export const bySortOrder = <T extends { id: string; sortOrder: number }>(a: T, b: T): number =>
  a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * The sortOrder that puts `id` directly above `overId`, given the list as it
 * is now. Returns null when either row is missing, or when the move changes
 * nothing.
 */
export function sortOrderForMove<T extends { id: string; sortOrder: number }>(
  items: T[],
  id: string,
  overId: string
): number | null {
  if (id === overId) return null
  const ordered = [...items].sort(bySortOrder).filter((item) => item.id !== id)
  if (ordered.length === items.length) return null
  const at = ordered.findIndex((item) => item.id === overId)
  if (at < 0) return null
  const before = at === 0 ? null : ordered[at - 1].sortOrder
  return sortOrderBetween(before, ordered[at].sortOrder)
}

/** The same rows, respaced one step apart in their current order. */
export function rebalanceSortOrders<T extends { id: string; sortOrder: number }>(items: T[]): T[] {
  return [...items]
    .sort(bySortOrder)
    .map((item, index) => ({ ...item, sortOrder: (index + 1) * SORT_ORDER_STEP }))
}

/**
 * The list half of drag-to-reorder: `id` moved to sit directly above
 * `overId`, without mutating the source. The checklist and the invoice's
 * lines are the same gesture over different rows.
 */
export function withMove<T extends { id: string }>(items: T[], id: string, overId: string): T[] {
  if (id === overId) return items
  const moved = items.find((item) => item.id === id)
  if (!moved) return items
  const rest = items.filter((item) => item.id !== id)
  const at = rest.findIndex((item) => item.id === overId)
  if (at < 0) return items
  return [...rest.slice(0, at), moved, ...rest.slice(at)]
}
