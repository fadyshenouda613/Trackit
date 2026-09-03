import { TODAY } from './time-data'
import type { Invoice } from './invoices-data'

/*
 * The specimen the printed artboard is designed against.
 *
 * Deliberately outside the `invoices` register. That file's header documents
 * figures reconciled across four screens — the Dashboard's outstanding position,
 * the Clients table's totals, the Attention list, the Northwind detail — and a
 * ten thousand dollar invoice dropped into it would quietly falsify all of them.
 * This one is a sheet to look at, not a record to count.
 *
 * It cannot collide either: INV-0150 is the number invoice-data.ts already
 * reserves as NEXT_NUMBER, so the register can never issue it twice.
 *
 * The work on it is real work. Trade show panels and Signage artwork are exactly
 * the two delivered-but-unbilled Northwind projects the Create invoice screen
 * lists, at the prices it lists them at, so the sheet bills the money the
 * Dashboard says is waiting rather than inventing a job to fill a page.
 */

export const printedInvoice: Invoice = {
  number: 'INV-0150',
  clientId: 'northwind',
  issued: TODAY,
  /* The one figure here with no source elsewhere. It is on the sheet because a
     printed invoice has to prove it can carry tax, and because a total ending
     in .25 is the only way to see whether the decimal column really aligns. */
  taxRate: 8.5,
  groups: [
    {
      project: 'Trade show panels',
      lines: [
        { id: 'tsp-1', label: 'Panel system layout, six panels', amount: 2000 },
        { id: 'tsp-2', label: 'Large-format artwork preparation', amount: 900 },
        { id: 'tsp-3', label: 'Repro and press check', amount: 500 }
      ]
    },
    {
      project: 'Signage artwork',
      lines: [
        { id: 'sig-1', label: 'Wayfinding sign family, nine types', amount: 2600 },
        { id: 'sig-2', label: 'Fascia and window vinyl artwork', amount: 1750 },
        { id: 'sig-3', label: 'Production files and specification sheet', amount: 1000 },
        { id: 'sig-4', label: 'Site survey amends', amount: 500 }
      ]
    }
  ],
  payments: [],
  notes:
    'Two revision rounds are included on each item, as agreed at kickoff. Production files transfer on receipt of final payment.'
}

/**
 * The terms, said in full. The document's date block already states "Net 14";
 * this is the sentence a client reads when they want to know what happens if
 * they do not.
 */
export const paymentTerms =
  'Payment is due within 14 days of the issue date. Interest of 1.5% per month applies to balances outstanding after 30 days.'

/*
 * Where the money goes. Nothing else in the app has ever needed this — the
 * in-app document has no reason to print an account number — so it is seeded
 * here alongside the sheet that does.
 */
export const bank = {
  name: 'Pacific Union Bank',
  account: 'Trackit Studio LLC',
  routing: '121000248',
  number: '4471 0092 3318',
  swift: 'PUBKUS6S'
}
