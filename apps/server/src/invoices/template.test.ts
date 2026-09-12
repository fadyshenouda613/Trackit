import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAPER_CSS, PAPER_CSS_SECTION } from './paper-css'
import { renderInvoiceHtml, type InvoiceDocument } from './template'

/*
 * The rendered sheet, pinned. The snapshot is the document a client would
 * receive for a two-project invoice with tax and notes — every branch the
 * template has, on one page — so any change to what the PDF says is a
 * change someone has to look at. And the drift check: the stylesheet the
 * template carries is a copy of print.css, and this is what keeps it one.
 */

const T = '2026-08-24T15:30:00.000Z'
const base = { createdAt: T, updatedAt: T, deletedAt: null, updatedBy: null }

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const document: InvoiceDocument = {
  invoice: {
    ...base,
    id: id(1),
    clientId: id(2),
    number: 'INV-0147',
    numberProvisional: false,
    pdfGeneratedAt: null,
    status: 'sent',
    currency: 'GBP',
    issuedAt: T,
    dueAt: '2026-09-07T15:30:00.000Z',
    taxRate: 8.5,
    subtotalCents: 1_120_000,
    taxCents: 95_200,
    totalCents: 1_215_200,
    notes: 'Half on receipt, the balance on approval of the print proofs.',
    voidedAt: null,
    voidReason: null,
    replacedByInvoiceId: null
  },
  lines: [
    { ...base, id: id(10), invoiceId: id(1), projectId: id(20), milestoneId: null, label: 'Editorial grid & master pages', amountCents: 220_000, sortOrder: 1 },
    { ...base, id: id(11), invoiceId: id(1), projectId: id(20), milestoneId: null, label: 'Section layouts, 48 pages', amountCents: 240_000, sortOrder: 2 },
    { ...base, id: id(12), invoiceId: id(1), projectId: id(21), milestoneId: null, label: 'Component library', amountCents: 320_000, sortOrder: 3 },
    { ...base, id: id(13), invoiceId: id(1), projectId: null, milestoneId: null, label: 'Stock photography <licences>', amountCents: 340_000, sortOrder: 4 }
  ],
  client: {
    ...base,
    id: id(2),
    name: 'Priya Raghunathan',
    company: 'Northwind Studio',
    email: 'priya@northwindstudio.com',
    phone: '',
    address: '14 Brick Lane\nLondon E1 6RF',
    currency: 'GBP',
    paymentTermsDays: 14,
    notes: ''
  },
  projects: { [id(20)]: 'Annual report layout', [id(21)]: 'Site build' },
  settings: {
    person: 'Alex Marchetti',
    businessName: 'Trackit Studio',
    address: '2130 Fillmore Street, Studio 4\nSan Francisco, CA 94115',
    email: 'billing@trackit.studio',
    phone: '+1 415 555 0142',
    logo: null,
    currency: 'USD',
    taxRate: 0,
    paymentTermsDays: 14,
    numberingScheme: 'INV-0000',
    rateFloorCents: 0,
    shortcut: 'CommandOrControl+Shift+S',
    updatedAt: T,
    updatedBy: null
  }
}

const assets = { fontCss: '/* fonts */' }

describe('renderInvoiceHtml', () => {
  it('renders the sheet for a two-project invoice with tax and notes', () => {
    expect(renderInvoiceHtml(document, assets)).toMatchSnapshot()
  })

  it('states every figure through the shared formatters, in the client currency', () => {
    const html = renderInvoiceHtml(document, assets)
    expect(html).toContain('£2,200.00')
    expect(html).toContain('Annual report layout subtotal')
    expect(html).toContain('£4,600.00')
    expect(html).toContain('Sales tax 8.5%')
    expect(html).toContain('£952.00')
    expect(html).toContain('£12,152.00')
    expect(html).toContain('Net 14')
    expect(html).toContain('Payment is due within 14 days of the issue date.')
    expect(html).toContain('24 Aug 2026')
    expect(html).toContain('07 Sep 2026')
  })

  it('escapes what people typed', () => {
    const html = renderInvoiceHtml(document, assets)
    expect(html).toContain('Stock photography &lt;licences&gt;')
    expect(html).not.toContain('<licences>')
    expect(html).toContain('Editorial grid &amp; master pages')
  })

  it('drops the group subtotals with one project, and the tax row with no tax', () => {
    const one: InvoiceDocument = {
      ...document,
      invoice: { ...document.invoice, taxRate: 0, taxCents: 0, totalCents: document.invoice.subtotalCents },
      lines: document.lines.slice(0, 2)
    }
    const html = renderInvoiceHtml(one, assets)
    expect(html).not.toContain('subtotal</span>')
    expect(html).not.toContain('Sales tax')
  })

  it('prints a draft with dashes for the dates it does not have', () => {
    const draft: InvoiceDocument = {
      ...document,
      invoice: { ...document.invoice, status: 'draft', issuedAt: null, dueAt: null }
    }
    const html = renderInvoiceHtml(draft, assets)
    expect(html).toContain('<dd class="num">—</dd>')
  })

  it('carries no app chrome: no desk, no panel, no token', () => {
    const html = renderInvoiceHtml(document, assets)
    expect(html).not.toContain('print-board')
    expect(html).not.toContain('state-panel')
    expect(html).not.toMatch(/var\(--(bg|text|line|accent)-/)
  })
})

describe('the copy of print.css', () => {
  it('is the .paper section of the renderer stylesheet, verbatim', () => {
    const file = resolve(__dirname, '../../../desktop/src/renderer/src/styles/print.css')
    const css = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    const from = css.indexOf(PAPER_CSS_SECTION.from)
    const to = css.indexOf(PAPER_CSS_SECTION.to)
    expect(from).toBeGreaterThan(-1)
    expect(to).toBeGreaterThan(from)
    const section = css.slice(from, to).trim()
    expect(
      PAPER_CSS.trim(),
      'print.css has changed: regenerate apps/server/src/invoices/paper-css.ts from it'
    ).toBe(section)
  })
})
