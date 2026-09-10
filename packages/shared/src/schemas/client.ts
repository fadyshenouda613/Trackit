/*
 * A client: who a project is for and who an invoice is sent to.
 *
 * The fields are the seven the New client dialog asks for, plus the phone the
 * client detail prints. `name` is the person, `company` the studio — the
 * Clients table shows both and the invoice is addressed to the company.
 */
import { z } from 'zod'
import { currencyCodeSchema, syncableEntity } from './primitives'

const clientFields = {
  /** The contact's name. Required: the table has no row without one. */
  name: z.string().trim().min(1),
  /** Optional on the dialog, so empty is allowed. */
  company: z.string().trim(),
  email: z.union([z.email(), z.literal('')]),
  phone: z.string().trim(),
  /** Billing address, one line per line, the way the printed invoice sets it. */
  address: z.string(),
  currency: currencyCodeSchema,
  /** Days from issue to due. Zero is "Due on receipt". */
  paymentTermsDays: z.number().int().nonnegative(),
  notes: z.string()
}

const entity = syncableEntity(clientFields)

export const clientSchema = entity.schema
export const createClientInputSchema = entity.create
export const updateClientInputSchema = entity.update
/** The row as it travels to the server. */
export const clientSyncRowSchema = entity.synced

export type Client = z.infer<typeof clientSchema>
export type CreateClientInput = z.infer<typeof createClientInputSchema>
export type UpdateClientInput = z.infer<typeof updateClientInputSchema>
