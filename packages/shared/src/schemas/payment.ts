/*
 * Money received against an invoice. An invoice carries payments until the
 * balance reaches zero; the status is read off the balance, never set by hand.
 */
import { z } from 'zod'
import { centsSchema, idSchema, syncableEntity, timestampSchema } from './primitives'

/**
 * The six methods the Record payment dialog lists. Stored as keys; the labels
 * the dialog shows are beside them.
 */
export const paymentMethodSchema = z.enum([
  'bank_transfer',
  'card',
  'cheque',
  'cash',
  'paypal',
  'other'
])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cheque: 'Cheque',
  cash: 'Cash',
  paypal: 'PayPal',
  other: 'Other'
}

const paymentFields = {
  invoiceId: idSchema,
  /** The date received, as the dialog asks for it. */
  paidAt: timestampSchema,
  /** Overpayments are allowed and named, not blocked; zero is not a payment. */
  amountCents: centsSchema.positive(),
  method: paymentMethodSchema,
  /** "Reference, or what it covers." */
  note: z.string().nullable()
}

const entity = syncableEntity(paymentFields)

export const paymentSchema = entity.schema
export const createPaymentInputSchema = entity.create
export const updatePaymentInputSchema = entity.update

export type Payment = z.infer<typeof paymentSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>
export type UpdatePaymentInput = z.infer<typeof updatePaymentInputSchema>
