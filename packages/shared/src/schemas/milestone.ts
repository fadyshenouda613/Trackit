/*
 * A milestone: a named stage of a project that can carry its own slice of the
 * fee and be invoiced on its own.
 *
 * Nothing in the app renders one yet — invoices group their lines by project,
 * not by milestone — so this shape comes from the data-model notes alone
 * rather than from a screen. It is here so an invoice line can point at one
 * (`milestoneId`) without a later migration changing the line.
 */
import { z } from 'zod'
import {
  centsSchema,
  idSchema,
  sortOrderSchema,
  syncableEntity,
  timestampSchema
} from './primitives'

const milestoneFields = {
  projectId: idSchema,
  name: z.string().trim().min(1),
  description: z.string(),
  /** The part of the fee this stage bills, or null when it is not billed apart. */
  amountCents: centsSchema.nonnegative().nullable(),
  dueAt: timestampSchema.nullable(),
  deliveredAt: timestampSchema.nullable(),
  sortOrder: sortOrderSchema
}

const entity = syncableEntity(milestoneFields)

export const milestoneSchema = entity.schema
export const createMilestoneInputSchema = entity.create
export const updateMilestoneInputSchema = entity.update
/** The row as it travels to the server. */
export const milestoneSyncRowSchema = entity.synced

export type Milestone = z.infer<typeof milestoneSchema>
export type CreateMilestoneInput = z.infer<typeof createMilestoneInputSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInputSchema>
