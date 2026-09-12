import {
  bank,
  formatCents,
  groupInvoiceLines,
  paymentTermsProse,
  shortDate,
  symbolOf,
  termsLabel
} from '@trackit/shared/helpers'
import type { SyncPullRow } from '@trackit/shared/schemas'
import { PAPER_CSS } from './paper-css'

/*
 * The invoice as the client receives it, as one HTML document.
 *
 * This is the renderer's PrintedInvoice, reproduced: the same structure,
 * the same class names, the same reading order — who it is from and what it
 * is, who it is for, what the work was, what it comes to, and at the foot
 * how to pay it — and the same figures through the same shared helpers, so
 * the PDF cannot disagree with the sheet on screen by a rounded cent. Its
 * stylesheet is the sheet's own, copied from print.css and checked against
 * it; the only additions are what a page with no app around it needs — the
 * font, embedded, and the page size.
 *
 * A pure function: data in, a string out. Nothing here knows about the
 * database or the browser that prints the string.
 */

export type InvoiceDocument = {
  invoice: SyncPullRow<'invoices'>
  /** Live lines, in sort order. */
  lines: SyncPullRow<'invoice_lines'>[]
  /** Null when the client row is gone; the sheet then addresses nobody. */
  client: SyncPullRow<'clients'> | null
  /** Project names by id, for the group headings. */
  projects: Record<string, string>
  settings: SyncPullRow<'settings'>
}

export type TemplateAssets = {
  /** The `@font-face` rules, with the files embedded. The test passes a stub. */
  fontCss: string
}

const escape = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** One `<span>` per non-empty line of a multi-line field. */
const lines = (text: string, className = ''): string =>
  text
    .split('\n')
    .filter(Boolean)
    .map((line) => (className ? `<span class="${className}">${escape(line)}</span>` : `<span>${escape(line)}</span>`))
    .join('\n')

/**
 * "26 Aug 2026", or an em dash for a draft's missing dates. The server has
 * no machine to be local to, so this is the UTC day of the instant; the
 * renderer's sheet uses the machine's own day.
 */
const dateLabel = (iso: string | null): string => (iso ? shortDate(iso) : '—')

/*
 * The Trackit mark, as Logo.tsx draws it for print: a ring with a gap on a
 * rounded tile. r 6.2 → circumference 38.96; 74% drawn, rotated so the gap
 * sits at about one o'clock.
 */
const RADIUS = 6.2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const DRAWN = CIRCUMFERENCE * 0.74

const logo = (size: number): string =>
  `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">` +
  `<rect width="24" height="24" rx="7" fill="var(--brand)"></rect>` +
  `<circle cx="12" cy="12" r="${RADIUS}" stroke="var(--paper-bg)" stroke-width="2.6" stroke-linecap="round" ` +
  `stroke-dasharray="${DRAWN} ${CIRCUMFERENCE - DRAWN}" transform="rotate(-76 12 12)"></circle></svg>`

/**
 * What the sheet needs beyond print.css: the font, a page with nothing
 * around it, and the print rules the renderer applies under @media print —
 * the sheet takes the page's width, its shadow goes, and the ink is kept
 * exactly rather than lightened by the print path.
 */
const pageCss = (fontCss: string): string => `
${fontCss}
:root { --font-sans: 'IBM Plex Sans Variable', 'IBM Plex Sans', Helvetica, Arial, sans-serif; }
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.num { font-variant-numeric: tabular-nums; }
.paper {
  width: auto;
  min-height: auto;
  box-shadow: none;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
`

export function renderInvoiceHtml(document: InvoiceDocument, assets: TemplateAssets): string {
  const { invoice, client, settings } = document
  const symbol = symbolOf(invoice.currency)
  const groups = groupInvoiceLines(document.lines, (projectId) => document.projects[projectId])
  /* One project's subtotal would be the invoice total said twice. */
  const grouped = groups.length > 1
  const brand = settings.businessName || settings.person

  const groupsHtml = groups
    .map(
      (group) => `
      <section class="paper__group">
        <h2 class="paper__group-name">${escape(group.project)}</h2>
${group.lines
  .map(
    (line) => `        <div class="paper__line">
          <span>${escape(line.label)}</span>
          <span class="paper__amount num">${formatCents(line.amountCents, symbol)}</span>
        </div>`
  )
  .join('\n')}${
    grouped
      ? `
        <div class="paper__group-total">
          <span>${escape(group.project)} subtotal</span>
          <span class="paper__amount num">${formatCents(group.totalCents, symbol)}</span>
        </div>`
      : ''
  }
      </section>`
    )
    .join('\n')

  /* A row reading 0% is a question with no answer, so it only appears on an
     invoice that actually carries tax. */
  const taxHtml =
    invoice.taxRate > 0
      ? `
        <div class="paper__totals-row">
          <span>Sales tax ${invoice.taxRate}%</span>
          <span class="paper__amount num">${formatCents(invoice.taxCents, symbol)}</span>
        </div>`
      : ''

  const notesHtml = invoice.notes
    ? `
          <span class="paper__overline paper__overline--spaced">Notes</span>
          <p class="paper__prose">${escape(invoice.notes)}</p>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${escape(invoice.number)}</title>
<style>
${pageCss(assets.fontCss)}
${PAPER_CSS}
</style>
</head>
<body>
<article class="paper">
  <header class="paper__head">
    <div class="paper__from">
      <div class="paper__brand">
        ${logo(26)}
        <span class="paper__brand-name">${escape(brand)}</span>
      </div>
      <span class="paper__from-person">${escape(settings.person)}</span>
${lines(settings.address)}
      <span>${escape(settings.email)}</span>
${settings.phone ? `      <span class="num">${escape(settings.phone)}</span>` : ''}
    </div>

    <div class="paper__meta">
      <span class="paper__kind">Invoice</span>
      <span class="paper__number num">${escape(invoice.number)}</span>

      <dl class="paper__dates">
        <dt>Issued</dt>
        <dd class="num">${dateLabel(invoice.issuedAt)}</dd>
        <dt>Due</dt>
        <dd class="num">${dateLabel(invoice.dueAt)}</dd>
        <dt>Terms</dt>
        <dd>${client ? termsLabel(client.paymentTermsDays) : '—'}</dd>
      </dl>
    </div>
  </header>

  <div class="paper__rule"></div>

  <div class="paper__bill">
    <span class="paper__overline">Bill to</span>
    <span class="paper__bill-name">${escape(client?.company ?? '—')}</span>
${client?.name ? `    <span class="paper__bill-line">${escape(client.name)}</span>` : ''}
${lines(client?.address ?? '', 'paper__bill-line')}
  </div>

  <div class="paper__items">
    <div class="paper__columns">
      <span class="paper__overline">Description</span>
      <span class="paper__overline paper__amount">Amount</span>
    </div>
${groupsHtml}
  </div>

  <div class="paper__totals">
    <div class="paper__totals-row">
      <span>Subtotal</span>
      <span class="paper__amount num">${formatCents(invoice.subtotalCents, symbol)}</span>
    </div>${taxHtml}
    <div class="paper__total">
      <span class="paper__total-label">Total due</span>
      <span class="paper__amount num">${formatCents(invoice.totalCents, symbol)}</span>
    </div>
  </div>

  <div class="paper__gap"></div>

  <footer class="paper__foot">
    <div class="paper__terms">
      <span class="paper__overline">Payment terms</span>
      <p class="paper__prose">${escape(paymentTermsProse(client?.paymentTermsDays ?? 0))}</p>${notesHtml}
    </div>

    <div class="paper__bank">
      <span class="paper__overline">Payment details</span>
      <dl class="paper__bank-list">
        <dt>Bank</dt>
        <dd>${escape(bank.name)}</dd>
        <dt>Account name</dt>
        <dd>${escape(bank.account)}</dd>
        <dt>Routing</dt>
        <dd class="num">${escape(bank.routing)}</dd>
        <dt>Account</dt>
        <dd class="num">${escape(bank.number)}</dd>
        <dt>SWIFT</dt>
        <dd class="num">${escape(bank.swift)}</dd>
        <dt>Reference</dt>
        <dd class="num paper__bank-ref">${escape(invoice.number)}</dd>
      </dl>
    </div>
  </footer>

  <div class="paper__strip">
    <span>${escape(brand)} · ${escape(settings.email)}</span>
    <span class="num">${escape(invoice.number)}</span>
  </div>
</article>
</body>
</html>
`
}
