/*
 * The schemas module — where every Trackit entity will be defined, once.
 *
 * No entities yet: this session moved the codebase into workspaces and added
 * nothing. What is here is the handful of primitives the repository's rules
 * (see CLAUDE.md) require every entity to be built from, so that when the
 * first entity schema is written it composes these rather than restating
 * them, and the rules are enforced by the parser rather than remembered.
 *
 *   money       integer cents, never a float
 *   timestamps  UTC ISO 8601 strings, formatted local only at render
 *   ids         client-generated UUIDv4
 *   deletes     soft only — `deletedAt` is set, the row is never removed
 *
 * Types are inferred from the schemas with `z.infer` and never redeclared.
 */
import { z } from 'zod'

/** A client-generated UUIDv4 — the id of everything. */
export const idSchema = z.uuid({ version: 'v4' })
export type Id = z.infer<typeof idSchema>

/**
 * An amount of money in integer cents. Floats do not survive arithmetic, and
 * an invoice that is off by a cent is an invoice someone has to explain.
 */
export const centsSchema = z.number().int()
export type Cents = z.infer<typeof centsSchema>

/** A moment in time as a UTC ISO 8601 string, e.g. `2026-08-28T09:15:00.000Z`. */
export const timestampSchema = z.iso.datetime()
export type Timestamp = z.infer<typeof timestampSchema>

/**
 * The columns every stored entity carries. Rows are never removed; a delete
 * sets `deletedAt`, and a query that wants only live rows filters on it.
 */
export const entityBaseSchema = z.object({
  id: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable()
})
export type EntityBase = z.infer<typeof entityBaseSchema>
