import { sql } from 'drizzle-orm'
import { nextInvoiceNumber, nextInvoiceSequence } from '@trackit/shared/helpers'
import type { Db } from '../db'
import { AppError } from '../errors'

/*
 * Issuing an invoice number, as a plain function over the database.
 *
 * The whole thing runs under the account's advisory lock — the same one a
 * sync takes — so a mint and an upload for one account are serial: a row
 * being uploaded cannot slip past the count, and two mints cannot read the
 * same highest number. The counter is the shared helper's, the same call
 * the desktop makes for a provisional number; what the server adds is that
 * it counts across every machine and hands each value out once.
 *
 * A number is reserved in invoice_numbers the moment it is handed out,
 * whether or not the invoice has been uploaded yet, and the same invoice
 * asking again gets the same answer. A lost response therefore costs
 * nothing, and a draft deleted before it ever went up simply leaves a gap.
 */

export async function mintInvoiceNumber(
  db: Db,
  userId: string,
  invoiceId: string,
  scheme: string,
  now: Date
): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`)

    const reserved = await tx.execute(
      sql`SELECT user_id, number FROM invoice_numbers WHERE invoice_id = ${invoiceId}`
    )
    const existing = reserved.rows[0] as { user_id: string; number: string } | undefined
    if (existing) {
      if (existing.user_id !== userId) throw new AppError(409, 'conflict', 'That invoice id is taken')
      return existing.number
    }

    /* Every number the account has actually used — deleted drafts included,
       as the desktop counts them — bar the provisional guesses, plus every
       number promised and not yet seen. */
    const used = await tx.execute(
      sql`SELECT number FROM invoices WHERE user_id = ${userId} AND number_provisional = false
          UNION
          SELECT number FROM invoice_numbers WHERE user_id = ${userId}`
    )
    const numbers = (used.rows as { number: string }[]).map((row) => row.number)
    const number = nextInvoiceNumber(scheme, nextInvoiceSequence(numbers, scheme), now)
    if (number === null) {
      throw new AppError(400, 'validation', 'The numbering scheme has no counter')
    }

    await tx.execute(
      sql`INSERT INTO invoice_numbers (invoice_id, user_id, number, reserved_at)
          VALUES (${invoiceId}, ${userId}, ${number}, ${now})`
    )
    return number
  })
}
