/*
 * A dated note on a project or on a client — the two screens that list them
 * are the project's Notes tab and the client detail's Notes panel. The date
 * the screens print is `createdAt`.
 */
import { z } from 'zod'
import { idSchema, syncableEntity } from './primitives'

const noteFields = {
  projectId: idSchema.nullable(),
  clientId: idSchema.nullable(),
  body: z.string().trim().min(1),
  pinned: z.boolean()
}

const entity = syncableEntity(noteFields)

/** A note belongs to exactly one thing. */
const ownedByOne = (note: { projectId: string | null; clientId: string | null }): boolean =>
  (note.projectId === null) !== (note.clientId === null)

const ownership = { message: 'A note belongs to exactly one project or one client' }

export const noteSchema = entity.schema.refine(ownedByOne, ownership)
export const createNoteInputSchema = entity.create.refine(ownedByOne, ownership)
/** A partial cannot prove ownership, so the store checks it after merging. */
export const updateNoteInputSchema = entity.update

export type Note = z.infer<typeof noteSchema>
export type CreateNoteInput = z.infer<typeof createNoteInputSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteInputSchema>
