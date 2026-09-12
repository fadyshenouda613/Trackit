/*
 * The sheet, as print.css draws it.
 *
 * This is the `.paper` section of apps/desktop/src/renderer/src/styles/print.css,
 * copied verbatim: from its first rule to the line before the @media print
 * block. print.css is where the sheet is designed; this file is only ever
 * regenerated from it, and template.test.ts fails the moment the two differ.
 *
 * Nothing here is a token of the app. The sheet declares its own ink.
 */

export const PAPER_CSS = `
.paper {
  /* ---- Ink ---------------------------------------------------------------
   * A four-step grey ramp and one brand hue. The brand value is the light-mode
   * accent rather than the dark one: oklch(0.505 0.190 274) holds on white and
   * survives a CMYK conversion, where the brighter screen violet would not. */
  color-scheme: light;
  --ink: oklch(0.22 0.01 265);
  --ink-soft: oklch(0.46 0.008 265);
  --ink-faint: oklch(0.6 0.008 265);
  --rule: oklch(0.88 0.004 265);
  --rule-strong: oklch(0.7 0.006 265);
  --paper-bg: #fff;
  --paper-tint: oklch(0.975 0.003 265);
  --brand: oklch(0.505 0.19 274);

  /* ---- The page ----------------------------------------------------------
   * A4 at 96dpi. The margin is ~17mm, inside every desktop printer's
   * non-printable edge, so nothing on the sheet is ever trimmed. */
  --page-w: 794px;
  --page-h: 1123px;
  --page-margin: 56px;
  /* Every figure on the sheet lands on this column's right edge — line
     amounts, group subtotals, tax and the total alike. It is the one vertical
     the eye runs down, so it is one number. */
  --amount-col: 132px;

  flex: 0 0 auto;
  width: var(--page-w);
  /* min-height, not height: an invoice with more work on it than this one
     should grow a second page, never lose a line off the bottom. */
  min-height: var(--page-h);
  padding: var(--page-margin);
  display: flex;
  flex-direction: column;
  background: var(--paper-bg);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 18px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.18),
    0 24px 48px -12px rgba(0, 0, 0, 0.35);
}

/* One overline for every small caption on the sheet. */
.paper__overline {
  font-size: 9px;
  font-weight: 600;
  line-height: 14px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.paper__overline--spaced {
  display: block;
  margin-top: 14px;
}

/* Amounts are right-aligned in a fixed column and never wrap. Pushed to the
   sheet edge, so the column is a real vertical rather than wherever each label
   happened to stop. */
.paper__amount {
  margin-left: auto;
  flex: 0 0 var(--amount-col);
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ---- Masthead ---------------------------------------------------------------
 * Sender and invoice face each other across the head: who is asking on the
 * left, what is being asked and by when on the right. */

.paper__head {
  display: flex;
  align-items: flex-start;
  gap: 40px;
}

.paper__from {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 11px;
  line-height: 17px;
  color: var(--ink-soft);
}

.paper__brand {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}

.paper__brand-name {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--ink);
}

.paper__from-person {
  color: var(--ink);
  font-weight: 500;
}

.paper__meta {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.paper__kind {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brand);
}

.paper__number {
  margin: 1px 0 8px;
  font-size: 25px;
  font-weight: 600;
  line-height: 30px;
  letter-spacing: -0.02em;
}

.paper__dates {
  margin: 0;
  display: grid;
  grid-template-columns: auto auto;
  gap: 4px 24px;
  font-size: 11px;
  line-height: 16px;
}

.paper__dates dt {
  color: var(--ink-faint);
}

.paper__dates dd {
  margin: 0;
  text-align: right;
  color: var(--ink);
  font-weight: 500;
}

.paper__rule {
  height: 1px;
  margin: 22px 0;
  background: var(--rule);
}

/* ---- Bill to ---------------------------------------------------------------- */

.paper__bill {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.paper__bill-name {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: -0.01em;
}

.paper__bill-line {
  font-size: 11px;
  line-height: 17px;
  color: var(--ink-soft);
}

/* ---- The work ---------------------------------------------------------------
 * Grouped by project, because a client billed for two of them should be able to
 * tell which is which before agreeing to the total. Each group carries its own
 * sum; with one project that sum is the invoice total said twice, and the
 * component drops it. */

.paper__items {
  margin-top: 22px;
}

.paper__columns {
  display: flex;
  align-items: baseline;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--rule-strong);
}

.paper__group {
  break-inside: avoid;
}

.paper__group-name {
  margin: 0 0 4px;
  padding: 16px 0 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: -0.005em;
  border-bottom: 1px solid var(--rule);
}

.paper__line {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 4px 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ink-soft);
}

.paper__line .paper__amount {
  color: var(--ink);
}

.paper__group-total {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 8px 0 0;
  margin-top: 6px;
  border-top: 1px solid var(--rule);
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-soft);
}

/* ---- Totals -----------------------------------------------------------------
 * Held to the amount column so subtotal, tax and total land on the same decimal
 * edge every line above them does. The total is the one figure on the sheet
 * with weight, because it is the only one the client acts on. */

.paper__totals {
  margin: 20px 0 0 auto;
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.paper__totals-row {
  display: flex;
  align-items: baseline;
  gap: 16px;
  font-size: 12px;
  color: var(--ink-soft);
}

.paper__total {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-top: 5px;
  padding-top: 11px;
  border-top: 1.5px solid var(--ink);
}

.paper__total-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}

.paper__total .paper__amount {
  font-size: 21px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: -0.02em;
}

/* Absorbs the slack on a short invoice so the foot sits at the bottom of the
   page. On one that fills the page it gives almost all of it back — the min is
   only there to stop the totals and the terms touching. */
.paper__gap {
  flex: 1;
  min-height: 18px;
}

/* ---- Foot -------------------------------------------------------------------
 * Terms and notes on the left, how to pay on the right. */

.paper__foot {
  display: flex;
  align-items: flex-start;
  gap: 32px;
  padding-top: 18px;
  border-top: 1px solid var(--rule);
  break-inside: avoid;
}

.paper__terms {
  flex: 1;
  min-width: 0;
}

.paper__prose {
  margin: 5px 0 0;
  max-width: 42ch;
  font-size: 11px;
  line-height: 17px;
  color: var(--ink-soft);
  text-wrap: pretty;
}

.paper__bank {
  flex: 0 0 268px;
  padding: 14px 16px 15px;
  border: 1px solid var(--rule);
  background: var(--paper-tint);
}

.paper__bank-list {
  margin: 8px 0 0;
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 4px 12px;
  font-size: 11px;
  line-height: 16px;
}

.paper__bank-list dt {
  color: var(--ink-faint);
}

.paper__bank-list dd {
  margin: 0;
  color: var(--ink);
  font-weight: 500;
}

/* The one line a payment actually has to carry back. */
.paper__bank-ref {
  color: var(--brand);
  font-weight: 600;
}

.paper__strip {
  display: flex;
  gap: 24px;
  margin-top: 18px;
  padding-top: 9px;
  border-top: 1px solid var(--rule);
  font-size: 10px;
  line-height: 14px;
  color: var(--ink-faint);
}

.paper__strip span:last-child {
  margin-left: auto;
}
`

/** Where the copy above starts and stops in print.css, for the drift check. */
export const PAPER_CSS_SECTION = { from: ".paper {", to: "/* ---- Actually printing it" } as const
