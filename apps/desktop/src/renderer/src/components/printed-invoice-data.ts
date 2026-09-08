/*
 * The two things the printed sheet says that no record holds.
 *
 * Everything else on the page now comes from the store — the invoice, its
 * lines, the client it is addressed to and the business profile in settings.
 * These two remain because the schema has nowhere to put them: a bank account
 * is not a field on anything, and the terms as prose are the sentence a client
 * reads when they want to know what happens if they do not pay, which the
 * date block's "Net 14" cannot say.
 */

/**
 * The terms, said in full. The document's date block already states the terms
 * as a label; this is the paragraph underneath it, written from the client's
 * own payment terms so the two can never disagree.
 */
export const paymentTermsProse = (days: number): string =>
  (days === 0
    ? 'Payment is due on receipt of this invoice.'
    : `Payment is due within ${days} days of the issue date.`) +
  ' Interest of 1.5% per month applies to balances outstanding after 30 days.'

/*
 * Where the money goes. Nothing else in the app has ever needed this — the
 * in-app document has no reason to print an account number — and no schema
 * carries it, so it is a constant beside the one sheet that shows it.
 */
export const bank = {
  name: 'Pacific Union Bank',
  account: 'Trackit Studio LLC',
  routing: '121000248',
  number: '4471 0092 3318',
  swift: 'PUBKUS6S'
}
