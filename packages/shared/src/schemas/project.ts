/*
 * A project: a fixed fee, an hours budget, and the hours that get logged
 * against it. The effective rate — price over logged hours — is computed,
 * never stored; see the rate helpers.
 */
import { z } from 'zod'
import {
  centsSchema,
  currencyCodeSchema,
  idSchema,
  syncableEntity,
  timestampSchema
} from './primitives'

/**
 * The six states on the "Status pills" board, in the order a project moves
 * through them, plus `archived`: the Clients artboard shows a paid project
 * from a previous year under that pill, so it is a state the app renders even
 * though nothing moves a project into it yet.
 */
export const projectStatusSchema = z.enum([
  'draft',
  'active',
  'delivered',
  'invoiced',
  'paid',
  'cancelled',
  'archived'
])
export type ProjectStatus = z.infer<typeof projectStatusSchema>

const projectFields = {
  clientId: idSchema,
  name: z.string().trim().min(1),
  /** "What you agreed to deliver, in the client's words." */
  description: z.string(),
  /** The fixed fee for the whole project. Trackit never multiplies it by hours. */
  priceCents: centsSchema.nonnegative(),
  currency: currencyCodeSchema,
  /** The freelancer's own estimate. Only used to warn as it is approached. */
  budgetedHours: z.number().nonnegative(),
  status: projectStatusSchema,
  /** When the project went active. Null while it is still a draft. */
  kickoffAt: timestampSchema.nullable(),
  dueAt: timestampSchema.nullable(),
  deliveredAt: timestampSchema.nullable()
}

const entity = syncableEntity(projectFields)

export const projectSchema = entity.schema
export const createProjectInputSchema = entity.create
export const updateProjectInputSchema = entity.update

export type Project = z.infer<typeof projectSchema>
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>

/**
 * The moves a person can make: draft → active, active → delivered, and
 * anything → cancelled. `invoiced` and `paid` are not on the list because
 * they follow from the invoice — sending one, settling one — and `archived`
 * because nothing moves a project there yet.
 */
export const projectTransitionSchema = z.enum(['active', 'delivered', 'cancelled'])
export type ProjectTransition = z.infer<typeof projectTransitionSchema>
