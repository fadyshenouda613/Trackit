import { sql } from 'drizzle-orm'
import type { SyncPullRow } from '@trackit/shared/schemas'
import type { Db } from '../db'
import { syncTables, toPullRow } from '../sync/tables'
import type { InvoiceDocument } from './template'

/*
 * Everything the sheet prints, read for one invoice of one account.
 *
 * Ownership is the query. The invoice is fetched by (id, user_id), and an
 * invoice that is not the caller's is null — the same answer as one that
 * does not exist, so nothing distinguishes the two from outside. Every row
 * beneath it is scoped by the same user id. Rows come back through the
 * sync tables' own conversion, so what the PDF reads is what a device
 * would pull, parsed by the shared schema.
 */

type Raw = Record<string, unknown>

/** What an account that has never uploaded its settings prints under. */
const DEFAULT_SETTINGS: SyncPullRow<'settings'> = {
  person: '',
  businessName: '',
  address: '',
  email: '',
  phone: '',
  logo: null,
  currency: 'USD',
  taxRate: 0,
  paymentTermsDays: 14,
  numberingScheme: 'INV-0000',
  rateFloorCents: 0,
  shortcut: 'CommandOrControl+Shift+S',
  updatedAt: '1970-01-01T00:00:00.000Z',
  updatedBy: null
}

export async function loadInvoiceDocument(
  db: Db,
  userId: string,
  invoiceId: string
): Promise<InvoiceDocument | null> {
  const found = await db.execute(
    sql`SELECT * FROM invoices WHERE id = ${invoiceId} AND user_id = ${userId} AND deleted_at IS NULL`
  )
  const rawInvoice = found.rows[0] as Raw | undefined
  if (!rawInvoice) return null
  const invoice = toPullRow(syncTables.invoices, rawInvoice) as SyncPullRow<'invoices'>

  const rawLines = await db.execute(
    sql`SELECT * FROM invoice_lines
        WHERE invoice_id = ${invoiceId} AND user_id = ${userId} AND deleted_at IS NULL
        ORDER BY sort_order, id`
  )
  const lines = (rawLines.rows as Raw[]).map(
    (raw) => toPullRow(syncTables.invoice_lines, raw) as SyncPullRow<'invoice_lines'>
  )

  const rawClient = await db.execute(
    sql`SELECT * FROM clients WHERE id = ${invoice.clientId} AND user_id = ${userId} AND deleted_at IS NULL`
  )
  const client = rawClient.rows[0]
    ? (toPullRow(syncTables.clients, rawClient.rows[0] as Raw) as SyncPullRow<'clients'>)
    : null

  const projectIds = [...new Set(lines.map((line) => line.projectId).filter((id): id is string => id !== null))]
  const projects: Record<string, string> = {}
  if (projectIds.length > 0) {
    const rawProjects = await db.execute(
      sql`SELECT id, name FROM projects WHERE user_id = ${userId} AND id IN ${projectIds}`
    )
    for (const row of rawProjects.rows as { id: string; name: string }[]) projects[row.id] = row.name
  }

  const rawSettings = await db.execute(sql`SELECT * FROM settings WHERE user_id = ${userId}`)
  const settings = rawSettings.rows[0]
    ? (toPullRow(syncTables.settings, rawSettings.rows[0] as Raw) as SyncPullRow<'settings'>)
    : DEFAULT_SETTINGS

  return { invoice, lines, client, projects, settings }
}
