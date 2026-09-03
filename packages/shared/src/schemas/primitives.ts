/*
 * The primitives every entity is built from, so that the repository's rules
 * (see CLAUDE.md) are enforced by the parser rather than remembered:
 *
 *   money       integer cents, never a float
 *   timestamps  UTC ISO 8601 strings, formatted local only at render
 *   ids         client-generated UUIDv4
 *   deletes     soft only — `deletedAt` is set, the row is never removed
 *   sync        every syncable row says whether the server has seen it
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
 * Whether the server has this version of the row. `pending` is set on every
 * local write and cleared to `synced` when the upload lands. Local only: the
 * server never stores it.
 */
export const syncStateSchema = z.enum(['pending', 'synced'])
export type SyncState = z.infer<typeof syncStateSchema>

/**
 * The currencies the Settings screen offers as a default. A client or project
 * picks one of the same list.
 */
export const currencyCodeSchema = z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD'])
export type CurrencyCode = z.infer<typeof currencyCodeSchema>

/**
 * A fractional position in a list. Moving a row assigns it the midpoint of its
 * new neighbours, so a reorder writes one row rather than renumbering the
 * list — see `sortOrderBetween` in the helpers.
 */
export const sortOrderSchema = z.number().finite()
export type SortOrder = z.infer<typeof sortOrderSchema>

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

/** The base for everything that travels to the server. */
export const syncableBaseSchema = entityBaseSchema.extend({
  syncState: syncStateSchema
})
export type SyncableBase = z.infer<typeof syncableBaseSchema>

/**
 * Derives the three schemas every entity exports from its own fields:
 *
 *   schema   the stored row — fields plus the base columns
 *   create   what a caller supplies to make one — the fields and the id it
 *            minted; the timestamps and sync state are the store's to set
 *   update   any subset of the fields; the id travels beside it, not in it
 */
// The return type is left to inference: spelling out three generic ZodObject
// instantiations by hand would only restate what `extend` and `partial` infer.
export function syncableEntity<S extends z.ZodRawShape>(fields: S) {
  const fieldsSchema = z.object(fields)
  return {
    schema: syncableBaseSchema.extend(fields),
    create: fieldsSchema.extend({ id: idSchema }),
    update: fieldsSchema.partial()
  }
}
