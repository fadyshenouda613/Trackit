/*
 * What is left of the pre-database invoice register.
 *
 * Every screen that used to render it now reads the store, and the float
 * `Invoice` model it was built on has gone with them — money is integer cents
 * everywhere, and a second, floating register was the last place in the
 * renderer that disagreed. Its client table came from invoice-data.ts, which
 * went at the same time.
 *
 * One constant survives, because one caller does: the Settings screen seeds
 * its business profile from here while it is still a form of typed text with
 * no writer on the store. Task 19 puts that screen on the settings row, and
 * Task 20 takes this file with it.
 */

/** Who the invoice is from, until Settings reads and writes the real row. */
export const business = {
  name: 'Trackit Studio',
  person: 'Alex Marchetti',
  lines: ['2130 Fillmore Street, Studio 4', 'San Francisco, CA 94115'],
  email: 'billing@trackit.studio',
  taxId: 'EIN 84-3927104'
}
