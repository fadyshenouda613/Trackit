import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Database } from 'better-sqlite3'
import { z } from 'zod'
import type { ApiErrorCode } from '@trackit/shared/api'
import { timestampSchema, type InvoicePdf, type SyncFailure, type SyncStatus } from '@trackit/shared/schemas'
import { nowIso } from '../db/clock'
import { invoicesTable, markPdfGenerated } from '../repositories/invoices'
import { RepositoryError } from '../repositories/errors'
import { requireRow } from '../repositories/table'
import { PdfClientError, type PdfTransport } from './client'

/*
 * Getting a PDF of an invoice onto this machine.
 *
 * The server renders from its copy of the row, so the first thing a
 * request does is sync and wait: a PDF of a stale row would not show what
 * the screen shows. Then the cache: a file already here for an invoice
 * that has not moved since is the answer, and nothing is rendered. Then
 * the fetch, streamed to a part-file and renamed into place, the stamp on
 * the invoice, and a note of which version of the row the file was made
 * from — the stamp itself moves the row, so the note is written after it.
 *
 * Plain functions over the database and a transport. Nothing here knows
 * about Electron; the dialog and the file manager are the handler's.
 */

export type PdfServiceDeps = {
  db: Database
  transport: PdfTransport
  /** Throws AuthClientError when signed out, expired, or unable to refresh. */
  accessToken: () => Promise<string>
  /** Runs a sync — after the one in flight, if any — and answers with the status after it. */
  sync: () => Promise<SyncStatus>
  /** Where the files live. Created on first use. */
  cacheDir: string
  now?: () => string
}

export type CachedPdf = {
  path: string
  /** "INV-0145.pdf" — what a save dialog offers. */
  fileName: string
}

export type PdfService = {
  generate: (invoiceId: string) => Promise<InvoicePdf>
  /** The file already here for an invoice, or null when none has been made on this machine. */
  cached: (invoiceId: string) => CachedPdf | null
}

/** Beside each file: which version of the row it was made from, and when. */
const sidecarSchema = z.object({
  invoiceUpdatedAt: timestampSchema,
  generatedAt: timestampSchema
})

/** A number as a file name: anything that is not a plain character becomes an underscore. */
export const pdfFileName = (number: string): string => `${number.replace(/[^A-Za-z0-9._-]+/g, '_')}.pdf`

/** What a failed sync means to someone who asked for a PDF. */
const codeForFailure: Record<SyncFailure, ApiErrorCode> = {
  offline: 'offline',
  signedOut: 'unauthorized',
  server: 'internal',
  tooOld: 'internal',
  otherAccount: 'internal'
}

const failureLines: Record<SyncFailure, string> = {
  offline: 'No connection. The PDF is made on the server.',
  signedOut: 'Sign in to make a PDF.',
  server: 'The server did not answer the sync the PDF needs first.',
  tooOld: 'This version is too old to sync, and the PDF needs a sync first.',
  otherAccount: 'This data belongs to another account.'
}

export function createPdfService(deps: PdfServiceDeps): PdfService {
  const now = deps.now ?? nowIso
  const fileOf = (invoiceId: string): string => join(deps.cacheDir, `${invoiceId}.pdf`)
  const sidecarOf = (invoiceId: string): string => join(deps.cacheDir, `${invoiceId}.json`)

  const readSidecar = (invoiceId: string): z.infer<typeof sidecarSchema> | null => {
    try {
      return sidecarSchema.parse(JSON.parse(readFileSync(sidecarOf(invoiceId), 'utf8')))
    } catch {
      return null
    }
  }

  const cached = (invoiceId: string): CachedPdf | null => {
    const file = fileOf(invoiceId)
    if (!existsSync(file)) return null
    const invoice = requireRow(deps.db, invoicesTable, invoiceId)
    return { path: file, fileName: pdfFileName(invoice.number) }
  }

  return {
    cached,

    generate: async (invoiceId) => {
      requireRow(deps.db, invoicesTable, invoiceId)

      const status = await deps.sync()
      if (status.state === 'failed' && status.failure) {
        throw new PdfClientError(codeForFailure[status.failure], failureLines[status.failure])
      }

      /* Read again: the sync may have moved the row. */
      const invoice = requireRow(deps.db, invoicesTable, invoiceId)
      if (invoice.syncState === 'pending') {
        throw new RepositoryError(
          'invalid_state',
          `${invoice.number} has changes the server has not taken yet, so its PDF would be out of date`
        )
      }

      const file = fileOf(invoiceId)
      const sidecar = readSidecar(invoiceId)
      if (existsSync(file) && sidecar && sidecar.invoiceUpdatedAt === invoice.updatedAt) {
        return { invoiceId, path: file, generatedAt: sidecar.generatedAt, cached: true }
      }

      mkdirSync(deps.cacheDir, { recursive: true })
      const part = `${file}.part`
      const token = await deps.accessToken()
      try {
        await deps.transport.download(token, invoiceId, part)
        renameSync(part, file)
      } finally {
        rmSync(part, { force: true })
      }

      const at = now()
      const stamped = markPdfGenerated(deps.db, invoiceId, at)
      writeFileSync(sidecarOf(invoiceId), JSON.stringify({ invoiceUpdatedAt: stamped.updatedAt, generatedAt: at }))
      return { invoiceId, path: file, generatedAt: at, cached: false }
    }
  }
}
