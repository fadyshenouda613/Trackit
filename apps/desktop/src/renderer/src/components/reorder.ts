/**
 * Drag-to-reorder, the pointer half.
 *
 * The checklist and the invoice's line items are the same gesture over
 * different rows. The move itself is `withMove` in @trackit/shared; each list
 * keeps its own pointer handling, and this is the state that handling holds.
 */

/** The row being dragged, and the row it would land above. */
export type DragState = {
  id: string
  overId: string
}
