/*
 * Settings — the values the rest of the app is judged against.
 *
 * One row, not a table, so it has no id and is never deleted; it carries
 * `updatedAt` and a sync state because settings changes do travel (the sync
 * popover counts them). Theme is the exception: it is a preference of this
 * machine, not of the account, and is not uploaded.
 *
 * The Settings screen holds every figure as typed text while you are in the
 * field; this is the shape it is parsed into at the edge.
 */
import { z } from 'zod'
import { centsSchema, currencyCodeSchema, syncStateSchema, timestampSchema } from './primitives'

export const themeSchema = z.enum(['dark', 'light', 'system'])
export type Theme = z.infer<typeof themeSchema>

/** A run of zeros is the counter; without one two invoices could share a number. */
export const numberingSchemeSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/0+/, 'A numbering scheme needs a run of zeros for the counter')

export const settingsSchema = z.object({
  /* Business profile — what the invoice says about you. */
  person: z.string(),
  businessName: z.string(),
  address: z.string(),
  email: z.union([z.email(), z.literal('')]),
  phone: z.string(),
  /** A data URL from the file picker, or nothing chosen yet. */
  logo: z.string().nullable(),

  /* Invoicing — what a new invoice starts with. */
  currency: currencyCodeSchema,
  /** Per cent, applied to the subtotal. */
  taxRate: z.number().min(0).max(100),
  paymentTermsDays: z.number().int().nonnegative(),
  numberingScheme: numberingSchemeSchema,

  /* Tracking — how logged hours are judged, and how the clock is started. */
  /** Not a billing rate: the line an effective rate is measured against. */
  rateFloorCents: centsSchema.nonnegative(),
  /** An Electron accelerator, e.g. `CommandOrControl+Shift+S`. */
  shortcut: z.string().trim().min(1),

  /* Appearance — this machine only. */
  theme: themeSchema,

  /* Account */
  accountEmail: z.string(),

  updatedAt: timestampSchema,
  syncState: syncStateSchema
})
export type Settings = z.infer<typeof settingsSchema>

export const updateSettingsInputSchema = settingsSchema
  .omit({ updatedAt: true, syncState: true })
  .partial()
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>

/**
 * The row as it travels to the server: no id (the account is the key), no
 * sync state, and neither of the two preferences that belong to the machine.
 */
export const settingsSyncRowSchema = settingsSchema.omit({
  theme: true,
  accountEmail: true,
  syncState: true
})
export type SettingsSyncRow = z.infer<typeof settingsSyncRowSchema>
