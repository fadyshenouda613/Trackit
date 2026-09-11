import { Router } from 'express'
import { idSchema, mintInvoiceNumberInputSchema } from '@trackit/shared/schemas'
import { requireAuth, type AuthLocals } from '../auth/middleware'
import type { AuthDeps } from '../auth/service'
import { AppError } from '../errors'
import { loadInvoiceDocument } from './document'
import { invoiceFontCss } from './fonts'
import { mintInvoiceNumber } from './numbers'
import type { PdfRenderer } from './pdf'
import { renderInvoiceHtml } from './template'

/*
 * The two things the server does for an invoice. Both routes are the same
 * three lines as every other: parse with the shared schema, call the plain
 * function, send what it returned. Both are the caller's own invoices only
 * — the mint reserves under the caller's account, the render loads by
 * (id, user_id) and answers 404 for anything else.
 */

export type InvoicesRouterOptions = {
  deps: AuthDeps
  pdf: PdfRenderer
}

/** A number as a file name: anything that is not a plain character becomes an underscore. */
const fileName = (number: string): string => `${number.replace(/[^A-Za-z0-9._-]+/g, '_')}.pdf`

export function invoicesRouter(options: InvoicesRouterOptions): Router {
  const { deps } = options
  const router = Router()

  router.post('/:id/number', requireAuth(deps), async (req, res) => {
    const { auth } = res.locals as AuthLocals
    const invoiceId = idSchema.parse(req.params['id'])
    const { scheme } = mintInvoiceNumberInputSchema.parse(req.body)
    const number = await mintInvoiceNumber(deps.db, auth.userId, invoiceId, scheme, deps.now())
    res.json({ invoiceId, number })
  })

  router.get('/:id/pdf', requireAuth(deps), async (req, res) => {
    const { auth } = res.locals as AuthLocals
    const invoiceId = idSchema.parse(req.params['id'])
    const document = await loadInvoiceDocument(deps.db, auth.userId, invoiceId)
    if (!document) throw new AppError(404, 'not_found', 'No invoice with that id')

    const html = renderInvoiceHtml(document, { fontCss: invoiceFontCss() })
    const pdf = await options.pdf.render(html)
    res.setHeader('content-type', 'application/pdf')
    res.setHeader('content-disposition', `attachment; filename="${fileName(document.invoice.number)}"`)
    res.send(Buffer.from(pdf))
  })

  return router
}
