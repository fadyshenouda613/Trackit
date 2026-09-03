/*
 * What a list can be asked for.
 *
 * These are the filters and sorts the screens already offer — the Status and
 * Client dropdowns and the sort segments on the Projects and Invoices lists,
 * the search fields, the week the Time screen shows — as the shapes that
 * cross the bridge. They are validated like every other input, so a query
 * the renderer builds is a query the store has agreed to answer.
 */
import { z } from 'zod'
import { invoiceStatusSchema } from './invoice'
import { idSchema, timestampSchema } from './primitives'
import { projectStatusSchema } from './project'

/** A status filter is one status or a set of them; absent means every status. */
const statusFilter = <S extends z.ZodEnum>(status: S) => z.union([status, z.array(status).min(1)])

export const clientListFiltersSchema = z.object({
  /** Matched against the contact's name and the company, case-insensitively. */
  search: z.string().trim().optional()
})
export type ClientListFilters = z.infer<typeof clientListFiltersSchema>

/** The four segments on the Projects toolbar. */
export const projectSortSchema = z.enum(['recent', 'rate', 'price', 'client'])
export type ProjectSort = z.infer<typeof projectSortSchema>

export const projectListFiltersSchema = z.object({
  status: statusFilter(projectStatusSchema).optional(),
  clientId: idSchema.optional(),
  search: z.string().trim().optional(),
  sort: projectSortSchema.optional()
})
export type ProjectListFilters = z.infer<typeof projectListFiltersSchema>

/** The four segments on the Invoices toolbar. */
export const invoiceSortSchema = z.enum(['issued', 'due', 'total', 'client'])
export type InvoiceSort = z.infer<typeof invoiceSortSchema>

export const invoiceListFiltersSchema = z.object({
  status: statusFilter(invoiceStatusSchema).optional(),
  clientId: idSchema.optional(),
  sort: invoiceSortSchema.optional()
})
export type InvoiceListFilters = z.infer<typeof invoiceListFiltersSchema>

/**
 * A window on the log: entries that started at or after `from` and before
 * `to`. The Time screen asks for a week at a time; a project's Time tab asks
 * for everything on one project.
 */
export const timeEntryListFiltersSchema = z.object({
  projectId: idSchema.optional(),
  from: timestampSchema.optional(),
  to: timestampSchema.optional()
})
export type TimeEntryListFilters = z.infer<typeof timeEntryListFiltersSchema>

/** Notes are listed for exactly one owner, the way they are stored. */
export const noteListFiltersSchema = z
  .object({
    projectId: idSchema.optional(),
    clientId: idSchema.optional()
  })
  .refine((filters) => (filters.projectId === undefined) !== (filters.clientId === undefined), {
    message: 'Notes are listed for one project or one client'
  })
export type NoteListFilters = z.infer<typeof noteListFiltersSchema>
