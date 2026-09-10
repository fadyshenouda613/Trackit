/*
 * A deliverable on a project's checklist.
 *
 * `addedAfterKickoff` is the whole point of the list: the number of items that
 * arrived once the project was active is what scope creep looks like as a
 * figure rather than a feeling. It is set when the item is created and never
 * changes — the checklist shows it, and never flags it. (The renderer's
 * fixture calls the same flag `addedLater`.)
 */
import { z } from 'zod'
import { idSchema, sortOrderSchema, syncableEntity } from './primitives'

const checklistItemFields = {
  projectId: idSchema,
  label: z.string().trim().min(1),
  done: z.boolean(),
  addedAfterKickoff: z.boolean(),
  sortOrder: sortOrderSchema
}

const entity = syncableEntity(checklistItemFields)

export const checklistItemSchema = entity.schema
export const createChecklistItemInputSchema = entity.create
export const updateChecklistItemInputSchema = entity.update
/** The row as it travels to the server. */
export const checklistItemSyncRowSchema = entity.synced

export type ChecklistItem = z.infer<typeof checklistItemSchema>
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemInputSchema>
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemInputSchema>

/**
 * What a caller supplies to add an item. `addedAfterKickoff` is not theirs to
 * say: the store reads the project's state at the moment of creation and sets
 * it, which is the only way the figure stays honest.
 */
export const newChecklistItemInputSchema = createChecklistItemInputSchema.omit({
  addedAfterKickoff: true
})
export type NewChecklistItemInput = z.infer<typeof newChecklistItemInputSchema>
