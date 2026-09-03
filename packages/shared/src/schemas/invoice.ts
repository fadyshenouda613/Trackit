/*
 * An invoice and its lines.
 *
 * The totals are snapshotted, not derived: once an invoice is sent it is a
 * document the client holds, and a project's price changing afterwards must
 * not move a number on it. The same goes for every line — the label and the
 * amount are the freelancer's words and figure at the time, which is why a
 * line only points at its project or milestone rather than reading from it.
 */
import { z } from 'zod'
import {
  centsSchema,
  currencyCodeSchema,
  idSchema,
  sortOrderSchema,
  syncableEntity,
  timestampSchema
} from './primitives'

/**
 * Five states. `partial` (shown as "Partially paid") and `void` are the two
 * the Invoices list adds to draft/sent/paid; the pill vocabulary in the
 * renderer uses the same keys.
 */
export const invoiceStatusSchema = z.enum(['draft', 'sent', 'partial', 'paid', 'void'])
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>

const invoiceFields = {
  clientId: idSchema,
  /** "INV-0150" — produced by the numbering scheme at issue, editable on the draft. */
  number: z.string().trim().min(1),
  status: invoiceStatusSchema,
  /** Written in the client's currency throughout, symbol included. */
  currency: currencyCodeSchema,
  /** Null on a draft: an unissued invoice has no date and no due date. */
  issuedAt: timestampSchema.nullable(),
  /** Issue date plus the client's terms, fixed at issue so the two never drift. */
  dueAt: timestampSchema.nullable(),
  /** Per cent of the subtotal, e.g. 8.5. Zero when no tax is charged. */
  taxRate: z.number().min(0).max(100),
  subtotalCents: centsSchema,
  taxCents: centsSchema,
  totalCents: centsSchema,
  /** Printed under the lines: bank details, what is included, when the balance is due. */
  notes: z.string(),
  voidedAt: timestampSchema.nullable(),
  voidReason: z.string().nullable(),
  /** The invoice reissued in its place, when a void was a correction. */
  replacedByInvoiceId: idSchema.nullable()
}

const entity = syncableEntity(invoiceFields)

type InvoiceShape = z.infer<typeof entity.create>

const consistent = (invoice: InvoiceShape, ctx: z.RefinementCtx): void => {
  if (invoice.totalCents !== invoice.subtotalCents + invoice.taxCents) {
    ctx.addIssue({
      code: 'custom',
      path: ['totalCents'],
      message: 'totalCents must equal subtotalCents plus taxCents'
    })
  }
  if ((invoice.status === 'draft') !== (invoice.issuedAt === null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['issuedAt'],
      message: 'A draft has no issue date; anything else has one'
    })
  }
  if ((invoice.status === 'void') !== (invoice.voidedAt !== null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['voidedAt'],
      message: 'voidedAt is set exactly when the status is void'
    })
  }
}

export const invoiceSchema = entity.schema.superRefine(consistent)
export const createInvoiceInputSchema = entity.create.superRefine(consistent)
/** A partial cannot prove consistency, so the store checks it after merging. */
export const updateInvoiceInputSchema = entity.update

export type Invoice = z.infer<typeof invoiceSchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceInputSchema>

/* ---- Lines ---------------------------------------------------------------- */

const invoiceLineFields = {
  invoiceId: idSchema,
  /** The project the line was ticked from, or null for a line typed by hand. */
  projectId: idSchema.nullable(),
  milestoneId: idSchema.nullable(),
  /** Snapshotted: editable on the invoice, never read back from the project. */
  label: z.string().trim().min(1),
  amountCents: centsSchema,
  sortOrder: sortOrderSchema
}

const line = syncableEntity(invoiceLineFields)

export const invoiceLineSchema = line.schema
export const createInvoiceLineInputSchema = line.create
export const updateInvoiceLineInputSchema = line.update

export type InvoiceLine = z.infer<typeof invoiceLineSchema>
export type CreateInvoiceLineInput = z.infer<typeof createInvoiceLineInputSchema>
export type UpdateInvoiceLineInput = z.infer<typeof updateInvoiceLineInputSchema>

/* ---- Raising one ---------------------------------------------------------- */

/**
 * A line as the Create invoice screen supplies it. On a line ticked from a
 * project the label and amount may be left out: the store copies the
 * project's name and price into the line at that moment, and from then on
 * the line is its own record. A line typed by hand has nothing to copy from,
 * so it must carry both.
 */
export const newInvoiceLineInputSchema = z
  .object({
    id: idSchema,
    projectId: idSchema.nullable(),
    milestoneId: idSchema.nullable().default(null),
    label: z.string().trim().min(1).optional(),
    amountCents: centsSchema.optional(),
    sortOrder: sortOrderSchema
  })
  .refine(
    (line) => line.projectId !== null || (line.label !== undefined && line.amountCents !== undefined),
    { message: 'A line typed by hand needs a label and an amount' }
  )
export type NewInvoiceLineInput = z.infer<typeof newInvoiceLineInputSchema>

/**
 * What raising an invoice takes. Everything else on the row is the store's:
 * the status starts at draft, the dates are set at issue, the totals are
 * summed from the lines, and a number or currency left out is taken from the
 * numbering scheme and the client.
 */
export const newInvoiceInputSchema = z.object({
  id: idSchema,
  clientId: idSchema,
  number: z.string().trim().min(1).optional(),
  currency: currencyCodeSchema.optional(),
  taxRate: z.number().min(0).max(100),
  notes: z.string().default(''),
  lines: z.array(newInvoiceLineInputSchema).min(1)
})
export type NewInvoiceInput = z.infer<typeof newInvoiceInputSchema>

/** Voiding needs a reason; naming the invoice reissued in its place is optional. */
export const voidInvoiceInputSchema = z.object({
  reason: z.string().trim().min(1),
  replacedByInvoiceId: idSchema.nullable().default(null)
})
export type VoidInvoiceInput = z.infer<typeof voidInvoiceInputSchema>
