/*
 * What the sync footer counts: rows this machine has changed that the server
 * has not seen. Five buckets, the ones the popover already lists.
 */
import { z } from 'zod'

export const pendingKindSchema = z.enum(['time', 'projects', 'invoices', 'payments', 'settings'])
export type PendingKind = z.infer<typeof pendingKindSchema>

/** A bucket with nothing pending is left out rather than sent as zero. */
export const pendingCountsSchema = z
  .object({
    time: z.number().int().nonnegative(),
    projects: z.number().int().nonnegative(),
    invoices: z.number().int().nonnegative(),
    payments: z.number().int().nonnegative(),
    settings: z.number().int().nonnegative()
  })
  .partial()
  .strict()
export type PendingCounts = z.infer<typeof pendingCountsSchema>
