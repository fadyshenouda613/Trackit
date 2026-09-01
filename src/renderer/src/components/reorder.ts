/**
 * Drag-to-reorder, the list half.
 *
 * The checklist and the invoice's line items are the same gesture over
 * different rows, so the move itself is shared and each list keeps its own
 * pointer handling.
 */

/** The row being dragged, and the row it would land above. */
export type DragState = {
  id: string
  overId: string
}

/** Moves `id` to sit directly above `overId`, without mutating the source. */
export function withMove<T extends { id: string }>(items: T[], id: string, overId: string): T[] {
  if (id === overId) return items
  const moved = items.find((item) => item.id === id)
  if (!moved) return items
  const rest = items.filter((item) => item.id !== id)
  const at = rest.findIndex((item) => item.id === overId)
  if (at < 0) return items
  return [...rest.slice(0, at), moved, ...rest.slice(at)]
}
