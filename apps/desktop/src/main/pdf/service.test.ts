import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SyncStatus } from '@trackit/shared/schemas'
import { AuthClientError } from '../auth/client'
import { openMemoryDatabase, type Database } from '../db'
import { RepositoryError } from '../repositories/errors'
import { createInvoice, getInvoice, updateInvoice } from '../repositories/invoices'
import { aClient, aProject, id } from '../repositories/test-support'
import { PdfClientError, type PdfTransport } from './client'
import { createPdfService, pdfFileName, type PdfServiceDeps } from './service'

/*
 * The service around one download: sync first, the cache, the stamp, and
 * what each refusal is called. The transport is a fake that writes bytes;
 * what the real one does with HTTP is client.test.ts's business.
 */

let db: Database
let cacheDir: string
let invoiceId: string
const NOW = '2026-09-11T12:00:00.000Z'

const saved: SyncStatus = { state: 'saved', lastSyncedAt: NOW, pending: {}, log: [], revision: 0 }
const failed = (failure: SyncStatus['failure']): SyncStatus => ({ ...saved, state: 'failed', failure })

/** Writes a small PDF-looking file; counts how often it was asked. */
function fakeTransport(bytes = '%PDF-1.7 fake'): PdfTransport & { downloads: number } {
  const transport = {
    downloads: 0,
    download: async (_token: string, _invoiceId: string, toFile: string) => {
      transport.downloads += 1
      writeFileSync(toFile, bytes)
    }
  }
  return transport
}

const markSynced = (): void => {
  db.prepare("UPDATE invoices SET sync_state = 'synced'").run()
}

function serviceWith(overrides: Partial<PdfServiceDeps> = {}) {
  const transport = fakeTransport()
  const service = createPdfService({
    db,
    transport,
    accessToken: async () => 'token',
    /* A sync that lands everything: what the cache and the stamp are tested against. */
    sync: async () => {
      markSynced()
      return saved
    },
    cacheDir,
    now: () => NOW,
    ...overrides
  })
  return { service, transport }
}

beforeEach(() => {
  db = openMemoryDatabase()
  cacheDir = mkdtempSync(join(tmpdir(), 'trackit-pdf-'))
  const client = aClient(db)
  const project = aProject(db, client, 'delivered')
  invoiceId = createInvoice(
    db,
    { id: id(), clientId: client.id, taxRate: 0, notes: '', lines: [{ id: id(), projectId: project.id, milestoneId: null, sortOrder: 1 }] },
    { number: 'INV-0150', numberProvisional: false }
  ).id
})

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true })
})

describe('generate', () => {
  it('syncs, downloads to the cache, stamps the invoice, and answers with the file', async () => {
    const { service, transport } = serviceWith()
    const result = await service.generate(invoiceId)

    expect(result).toEqual({ invoiceId, path: join(cacheDir, `${invoiceId}.pdf`), generatedAt: NOW, cached: false })
    expect(readFileSync(result.path, 'utf8')).toBe('%PDF-1.7 fake')
    expect(existsSync(`${result.path}.part`)).toBe(false)
    expect(transport.downloads).toBe(1)
    expect(getInvoice(db, invoiceId)).toMatchObject({ pdfGeneratedAt: NOW, syncState: 'pending' })
    expect(service.cached(invoiceId)).toEqual({ path: result.path, fileName: 'INV-0150.pdf' })
  })

  it('serves the cached file while the invoice has not moved, and renders again once it has', async () => {
    const { service, transport } = serviceWith()
    await service.generate(invoiceId)
    /* The stamp left the row pending; the next request's sync lands it, unchanged. */
    const again = await service.generate(invoiceId)
    expect(again.cached).toBe(true)
    expect(transport.downloads).toBe(1)

    updateInvoice(db, invoiceId, { notes: 'Half on receipt.' })
    const afterEdit = await service.generate(invoiceId)
    expect(afterEdit.cached).toBe(false)
    expect(transport.downloads).toBe(2)
  })

  it('refuses while the sync could not happen, in the words the rail shows', async () => {
    const offline = serviceWith({ sync: async () => failed('offline') })
    await expect(offline.service.generate(invoiceId)).rejects.toMatchObject({ code: 'offline' })
    expect(offline.transport.downloads).toBe(0)

    const signedOut = serviceWith({ sync: async () => failed('signedOut') })
    await expect(signedOut.service.generate(invoiceId)).rejects.toMatchObject({ code: 'unauthorized' })

    const server = serviceWith({ sync: async () => failed('server') })
    await expect(server.service.generate(invoiceId)).rejects.toBeInstanceOf(PdfClientError)
  })

  it('refuses an invoice the server has not taken yet', async () => {
    /* A sync that reports success but left the row pending: a rejected row. */
    const { service, transport } = serviceWith({ sync: async () => ({ ...saved, state: 'pending', pending: { invoices: 1 } }) })
    await expect(service.generate(invoiceId)).rejects.toMatchObject({ code: 'invalid_state' })
    expect(transport.downloads).toBe(0)
  })

  it('leaves no part-file and no stamp behind a failed download', async () => {
    const { service } = serviceWith({
      transport: {
        download: async (_t, _i, toFile) => {
          writeFileSync(toFile, 'half')
          throw new PdfClientError('offline', 'cut off')
        }
      }
    })
    await expect(service.generate(invoiceId)).rejects.toMatchObject({ code: 'offline' })
    expect(existsSync(join(cacheDir, `${invoiceId}.pdf`))).toBe(false)
    expect(existsSync(join(cacheDir, `${invoiceId}.pdf.part`))).toBe(false)
    expect(getInvoice(db, invoiceId)?.pdfGeneratedAt).toBeNull()
    expect(service.cached(invoiceId)).toBeNull()
  })

  it('passes on a refused token and an unknown invoice', async () => {
    const { service } = serviceWith({
      accessToken: async () => {
        throw new AuthClientError('unauthorized', 'Not signed in')
      }
    })
    await expect(service.generate(invoiceId)).rejects.toBeInstanceOf(AuthClientError)
    await expect(service.generate(id())).rejects.toBeInstanceOf(RepositoryError)
  })
})

describe('pdfFileName', () => {
  it('keeps a number as a file name and replaces what a file name cannot hold', () => {
    expect(pdfFileName('INV-0150')).toBe('INV-0150.pdf')
    expect(pdfFileName('2026/09 #12')).toBe('2026_09_12.pdf')
  })
})
