/*
 * A span of time logged against a project.
 *
 * `endedAt` is null while the timer is running — that row is the running
 * timer, and a launch that finds one is what the recovery dialog is for. The
 * Time screen's rows are the same shape with both ends set. `source` records
 * whether the clock made it or a person typed it.
 */
import { z } from 'zod'
import { idSchema, syncableEntity, timestampSchema } from './primitives'

export const timeEntrySourceSchema = z.enum(['timer', 'manual'])
export type TimeEntrySource = z.infer<typeof timeEntrySourceSchema>

const timeEntryFields = {
  projectId: idSchema,
  /** The deliverable the timer bar names, when the timer was started on one. */
  checklistItemId: idSchema.nullable(),
  note: z.string(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable(),
  source: timeEntrySourceSchema
}

const entity = syncableEntity(timeEntryFields)

const endsAfterStart = (entry: { startedAt: string; endedAt: string | null }): boolean =>
  entry.endedAt === null || entry.endedAt >= entry.startedAt

const ordering = { message: 'A time entry cannot end before it starts', path: ['endedAt'] }

export const timeEntrySchema = entity.schema.refine(endsAfterStart, ordering)
export const createTimeEntryInputSchema = entity.create.refine(endsAfterStart, ordering)
/** A partial may carry only one end, so the store checks the order after merging. */
export const updateTimeEntryInputSchema = entity.update
/** The row as it travels to the server, under the same ordering rule. */
export const timeEntrySyncRowSchema = entity.synced.refine(endsAfterStart, ordering)

export type TimeEntry = z.infer<typeof timeEntrySchema>
export type CreateTimeEntryInput = z.infer<typeof createTimeEntryInputSchema>
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntryInputSchema>

/**
 * What starting the clock takes: the project, and optionally the deliverable
 * the bar will name. The store supplies `startedAt`, `endedAt: null` and
 * `source: 'timer'`, so the renderer cannot start a clock in the past.
 */
export const startTimerInputSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  checklistItemId: idSchema.nullable().default(null),
  note: z.string().default('')
})
export type StartTimerInput = z.infer<typeof startTimerInputSchema>
