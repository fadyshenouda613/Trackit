/*
 * Everything that crosses a boundary for sync, defined once:
 *
 *   the wire      what `POST /sync` takes and answers — rows per table, a
 *                 cursor, a page flag, and the rows the server would not keep
 *   the status    what the sidebar footer and the popover read
 *   the conflict  a local edit that lost, kept until the person has seen it
 *
 * A wire row is the entity without `syncState` (the `synced` shape every
 * entity module exports), because whether the server has a row is a fact
 * about the client's copy and not about the row. Settings travel without
 * the two preferences that belong to the machine rather than the account.
 */
import { z } from 'zod'
import { checklistItemSyncRowSchema } from './checklist-item'
import { clientSyncRowSchema } from './client'
import { invoiceLineSyncRowSchema, invoiceSyncRowSchema } from './invoice'
import { milestoneSyncRowSchema } from './milestone'
import { noteSyncRowSchema } from './note'
import { paymentSyncRowSchema } from './payment'
import { idSchema, timestampSchema } from './primitives'
import { projectSyncRowSchema } from './project'
import { settingsSyncRowSchema } from './settings'
import { timeEntrySyncRowSchema } from './time-entry'

/* ---- Pending counts ---------------------------------------------------------
 * What the footer counts: rows this machine has changed that the server has
 * not seen. Six buckets. Checklist items, milestones and notes count under
 * the project they belong to; every syncable table lands in one of them, so
 * "nothing waiting" is never said while a row waits.
 */

export const pendingKindSchema = z.enum(['time', 'projects', 'clients', 'invoices', 'payments', 'settings'])
export type PendingKind = z.infer<typeof pendingKindSchema>

/** A bucket with nothing pending is left out rather than sent as zero. */
export const pendingCountsSchema = z.partialRecord(pendingKindSchema, z.number().int().nonnegative())
export type PendingCounts = z.infer<typeof pendingCountsSchema>

/* ---- Tables ---------------------------------------------------------------- */

/**
 * Parents before children. Rows are pushed, stored and applied in this
 * order, so a row never arrives before the one it references within a
 * request or a page.
 */
export const SYNC_TABLE_ORDER = [
  'clients',
  'projects',
  'milestones',
  'checklist_items',
  'notes',
  'invoices',
  'invoice_lines',
  'time_entries',
  'payments',
  'settings'
] as const

export const syncTableNameSchema = z.enum(SYNC_TABLE_ORDER)
export type SyncTableName = z.infer<typeof syncTableNameSchema>

/** What a client sends: the row as it stores it, minus its sync state. */
export const syncPushRowSchemas = {
  clients: clientSyncRowSchema,
  projects: projectSyncRowSchema,
  milestones: milestoneSyncRowSchema,
  checklist_items: checklistItemSyncRowSchema,
  notes: noteSyncRowSchema,
  invoices: invoiceSyncRowSchema,
  invoice_lines: invoiceLineSyncRowSchema,
  time_entries: timeEntrySyncRowSchema,
  payments: paymentSyncRowSchema,
  settings: settingsSyncRowSchema
} as const

/**
 * The device whose write is the version being sent. Null for rows written
 * before the column existed. Ties on `updatedAt` are broken by comparing it,
 * which is what lets two machines resolve the same pair the same way.
 */
const writtenBy = { updatedBy: idSchema.nullable() }

/** What the server sends back: the same row, plus who wrote it. */
export const syncPullRowSchemas = {
  clients: clientSyncRowSchema.safeExtend(writtenBy),
  projects: projectSyncRowSchema.safeExtend(writtenBy),
  milestones: milestoneSyncRowSchema.safeExtend(writtenBy),
  checklist_items: checklistItemSyncRowSchema.safeExtend(writtenBy),
  notes: noteSyncRowSchema.safeExtend(writtenBy),
  invoices: invoiceSyncRowSchema.safeExtend(writtenBy),
  invoice_lines: invoiceLineSyncRowSchema.safeExtend(writtenBy),
  time_entries: timeEntrySyncRowSchema.safeExtend(writtenBy),
  payments: paymentSyncRowSchema.safeExtend(writtenBy),
  settings: settingsSyncRowSchema.safeExtend(writtenBy)
} as const

export type SyncPushRow<T extends SyncTableName = SyncTableName> = z.infer<(typeof syncPushRowSchemas)[T]>
export type SyncPullRow<T extends SyncTableName = SyncTableName> = z.infer<(typeof syncPullRowSchemas)[T]>

/* ---- Request and response ---------------------------------------------------- */

/**
 * Bumped when a change to the wire would leave an older client unable to
 * read it. A server that no longer speaks a client's version answers 426.
 */
export const SYNC_PROTOCOL_VERSION = 1

/* Strict: a table this version does not know is a protocol mistake, not noise. */
const pushChangesSchema = z.strictObject({
  clients: z.array(syncPushRowSchemas.clients).optional(),
  projects: z.array(syncPushRowSchemas.projects).optional(),
  milestones: z.array(syncPushRowSchemas.milestones).optional(),
  checklist_items: z.array(syncPushRowSchemas.checklist_items).optional(),
  notes: z.array(syncPushRowSchemas.notes).optional(),
  invoices: z.array(syncPushRowSchemas.invoices).optional(),
  invoice_lines: z.array(syncPushRowSchemas.invoice_lines).optional(),
  time_entries: z.array(syncPushRowSchemas.time_entries).optional(),
  payments: z.array(syncPushRowSchemas.payments).optional(),
  settings: z.array(syncPushRowSchemas.settings).optional()
})

const pullChangesSchema = z.strictObject({
  clients: z.array(syncPullRowSchemas.clients).optional(),
  projects: z.array(syncPullRowSchemas.projects).optional(),
  milestones: z.array(syncPullRowSchemas.milestones).optional(),
  checklist_items: z.array(syncPullRowSchemas.checklist_items).optional(),
  notes: z.array(syncPullRowSchemas.notes).optional(),
  invoices: z.array(syncPullRowSchemas.invoices).optional(),
  invoice_lines: z.array(syncPullRowSchemas.invoice_lines).optional(),
  time_entries: z.array(syncPullRowSchemas.time_entries).optional(),
  payments: z.array(syncPullRowSchemas.payments).optional(),
  settings: z.array(syncPullRowSchemas.settings).optional()
})

export type SyncPushChanges = z.infer<typeof pushChangesSchema>
export type SyncPullChanges = z.infer<typeof pullChangesSchema>

/**
 * `since` is the cursor the last response gave, or 0 on a machine that has
 * never synced — which pulls the whole history, and is how a second machine
 * fills itself. `deviceId` is minted once per install and is what breaks
 * ties.
 */
export const syncRequestSchema = z.object({
  protocolVersion: z.literal(SYNC_PROTOCOL_VERSION),
  deviceId: idSchema,
  since: z.number().int().nonnegative(),
  changes: pushChangesSchema
})
export type SyncRequest = z.infer<typeof syncRequestSchema>

/**
 * Why the server kept none of a pushed row. Not a row that lost on
 * `updatedAt` — that one comes back in `changes` as the winner and needs no
 * name here.
 *
 *   missing_parent  the row references something the server does not hold
 *                   for this account; the client keeps it pending and tries
 *                   again once the parent has gone up
 *   forbidden       the row is another account's, or does not parse; the
 *                   client stops re-sending it
 */
export const syncRejectionReasonSchema = z.enum(['missing_parent', 'forbidden'])
export type SyncRejectionReason = z.infer<typeof syncRejectionReasonSchema>

export const syncRejectionSchema = z.object({
  table: syncTableNameSchema,
  /** Settings has no id; its rejections carry an empty string. */
  id: z.string(),
  reason: syncRejectionReasonSchema
})
export type SyncRejection = z.infer<typeof syncRejectionSchema>

/**
 * `changes` is every row of the account's with a sequence after `since`, in
 * sequence order, capped — `hasMore` says a page follows — plus the stored
 * winner of every pushed row that lost, whatever its sequence. `cursor` is
 * the sequence of the last row in the page.
 */
export const syncResponseSchema = z.object({
  cursor: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  changes: pullChangesSchema,
  rejected: z.array(syncRejectionSchema)
})
export type SyncResponse = z.infer<typeof syncResponseSchema>

/* ---- Status ------------------------------------------------------------------ */

/**
 * saved    nothing is waiting, and the last attempt worked
 * syncing  an attempt is in flight
 * pending  work is queued and the last attempt worked — ordinary, not a fault
 * failed   an attempt did not work, and the reason says what to do about it
 */
export const syncStatusStateSchema = z.enum(['saved', 'syncing', 'pending', 'failed'])
export type SyncStatusState = z.infer<typeof syncStatusStateSchema>

/**
 * Why a sync failed, in the person's terms rather than the transport's. A
 * closed set, because every one of them has to be a sentence someone can act
 * on.
 *
 *   offline       the server could not be reached
 *   signedOut     no session, or one the server no longer honours
 *   server        the server answered, but not with a sync
 *   tooOld        this build's protocol version is no longer accepted
 *   otherAccount  this machine's data was first synced under another account
 */
export const syncFailureSchema = z.enum(['offline', 'signedOut', 'server', 'tooOld', 'otherAccount'])
export type SyncFailure = z.infer<typeof syncFailureSchema>

export const syncEventKindSchema = z.enum(['synced', 'failed', 'conflict'])
export type SyncEventKind = z.infer<typeof syncEventKindSchema>

/** One line of the popover's log. */
export const syncEventSchema = z.object({
  id: idSchema,
  kind: syncEventKindSchema,
  at: timestampSchema,
  detail: z.string()
})
export type SyncEvent = z.infer<typeof syncEventSchema>

/**
 * What the footer, the popover and Settings › Account read. Derived by the
 * engine, never stored: `syncing` while a run is in flight, else `failed` if
 * the last run failed, else `pending` if anything waits, else `saved`.
 * `revision` moves whenever a sync changed local data, which is the
 * renderer's cue to refetch everything.
 */
export const syncStatusSchema = z.object({
  state: syncStatusStateSchema,
  lastSyncedAt: timestampSchema.nullable(),
  pending: pendingCountsSchema,
  failure: syncFailureSchema.optional(),
  log: z.array(syncEventSchema),
  revision: z.number().int().nonnegative()
})
export type SyncStatus = z.infer<typeof syncStatusSchema>

/* ---- Conflicts ---------------------------------------------------------------- */

/**
 * record   the same row was edited (or deleted) here and elsewhere, and the
 *          other version won
 * reorder  a checklist item was moved here and elsewhere; only its position
 *          differed, and the other position won
 */
export const syncConflictKindSchema = z.enum(['record', 'reorder'])
export type SyncConflictKind = z.infer<typeof syncConflictKindSchema>

/**
 * A local pending edit that lost to a newer version from another device.
 * Already resolved by the time it is read — the other version is what the
 * row now holds — and kept so the person can see it and, if they want,
 * have their own version back.
 */
export const syncConflictSchema = z.object({
  id: idSchema,
  table: syncTableNameSchema,
  /** Settings has no id; its conflicts carry an empty string. */
  rowId: z.string(),
  kind: syncConflictKindSchema,
  /** The project the row belongs to, when it belongs to one, so a notice can open it. */
  projectId: idSchema.nullable(),
  /** How the record is named to a person: a name, a number, a label. */
  label: z.string(),
  /** The fields that differed between the two versions. */
  fields: z.array(z.string()),
  /** Set when this machine had deleted the row. */
  localDeletedAt: timestampSchema.nullable(),
  /** Set when the other device had deleted the row. */
  remoteDeletedAt: timestampSchema.nullable(),
  detectedAt: timestampSchema
})
export type SyncConflict = z.infer<typeof syncConflictSchema>

/**
 * keepTheirs   leave the row as the other device left it; the conflict is done
 * restoreMine  write this machine's version back as a fresh edit, so it wins
 *              the next sync everywhere — for a reorder, the position alone
 */
export const conflictResolutionSchema = z.enum(['keepTheirs', 'restoreMine'])
export type ConflictResolution = z.infer<typeof conflictResolutionSchema>

export const resolveConflictInputSchema = z.object({
  id: idSchema,
  resolution: conflictResolutionSchema
})
export type ResolveConflictInput = z.infer<typeof resolveConflictInputSchema>
