/*
 * The two things the server does for an invoice that the desktop cannot do
 * for itself: issue its number, and print it.
 *
 * Numbers are issued server-side because a counter has to be handed out
 * once, and only one place can promise that when two machines draft
 * offline. The PDF is made server-side because that is where the current
 * row of every device lives, and because a headless browser has no place
 * inside an Electron app that is already one.
 */
import { z } from 'zod'
import { idSchema, timestampSchema } from './primitives'
import { numberingSchemeSchema } from './settings'

/**
 * `POST /invoices/:id/number`. The scheme is this machine's setting: what
 * the server guarantees is the counter, whatever the number is written in.
 */
export const mintInvoiceNumberInputSchema = z.object({
  scheme: numberingSchemeSchema
})
export type MintInvoiceNumberInput = z.infer<typeof mintInvoiceNumberInputSchema>

/** What the mint answers with — the same number again on a retry. */
export const mintedInvoiceNumberSchema = z.object({
  invoiceId: idSchema,
  number: z.string().trim().min(1)
})
export type MintedInvoiceNumber = z.infer<typeof mintedInvoiceNumberSchema>

/**
 * What `pdf.generate` answers with over the bridge: where the file is on
 * this machine, when it was made, and whether it was already there.
 */
export const invoicePdfSchema = z.object({
  invoiceId: idSchema,
  /** An absolute path in this machine's cache. */
  path: z.string().min(1),
  generatedAt: timestampSchema,
  /** True when the cached file was current and nothing was rendered. */
  cached: z.boolean()
})
export type InvoicePdf = z.infer<typeof invoicePdfSchema>
