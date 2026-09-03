/**
 * Invoice numbering.
 *
 * A scheme is a string like `INV-0000` or `{YYYY}-{MM}-000`. A run of zeros
 * is the counter and sets its own width, so `INV-0000` and `INV-000000` both
 * work and differ only in padding. `{YYYY}`, `{YY}` and `{MM}` are filled in
 * from the issue date.
 *
 * The counter is located in the scheme *before* the date tokens are filled
 * in. A year like 2026 and a month like 08 contain zeros of their own, and a
 * generator that substituted first would mistake them for the counter.
 */

const COUNTER = /0+/

/** Whether a scheme can count at all. Without a counter two invoices could share a number. */
export const schemeHasCounter = (scheme: string): boolean => COUNTER.test(scheme)

/** The parts of a scheme either side of its counter, and the counter's width. */
function splitScheme(scheme: string): { before: string; after: string; width: number } | null {
  const counter = COUNTER.exec(scheme)
  if (!counter) return null
  const [zeros] = counter
  return {
    before: scheme.slice(0, counter.index),
    after: scheme.slice(counter.index + zeros.length),
    width: zeros.length
  }
}

const fillDate = (template: string, at: Date): string => {
  const year = String(at.getUTCFullYear())
  const month = String(at.getUTCMonth() + 1).padStart(2, '0')
  return template
    .replace(/\{YYYY\}/g, year)
    .replace(/\{YY\}/g, year.slice(2))
    .replace(/\{MM\}/g, month)
}

const toDate = (at: string | Date): Date => (at instanceof Date ? at : new Date(at))

/**
 * The number the next invoice takes under a scheme, for a given counter value
 * and issue date. Returns null when the scheme has no counter: the field says
 * so rather than inventing a number.
 */
export function nextInvoiceNumber(
  scheme: string,
  sequence: number,
  at: string | Date
): string | null {
  const parts = splitScheme(scheme)
  if (!parts) return null
  const date = toDate(at)
  const counter = String(Math.max(0, Math.trunc(sequence))).padStart(parts.width, '0')
  return `${fillDate(parts.before, date)}${counter}${fillDate(parts.after, date)}`
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A scheme as a pattern that matches the numbers it produces, capturing the counter. */
function schemePattern(scheme: string): RegExp | null {
  const parts = splitScheme(scheme)
  if (!parts) return null
  const literal = (template: string): string =>
    escapeRegExp(template)
      .replace(/\\\{YYYY\\\}/g, '\\d{4}')
      .replace(/\\\{YY\\\}/g, '\\d{2}')
      .replace(/\\\{MM\\\}/g, '\\d{2}')
  return new RegExp(`^${literal(parts.before)}(\\d+)${literal(parts.after)}$`)
}

/**
 * The counter an existing number carries under a scheme, or null when the
 * number was not produced by it. Reads the counter by position, so a year or
 * month in the number is never mistaken for it.
 */
export function invoiceSequenceOf(number: string, scheme: string): number | null {
  const pattern = schemePattern(scheme)
  if (!pattern) return null
  const match = pattern.exec(number)
  return match ? Number(match[1]) : null
}

/**
 * One past the highest counter among the numbers that follow the scheme.
 * Numbers from another scheme are ignored; with none that match, counting
 * starts at 1.
 */
export function nextInvoiceSequence(numbers: string[], scheme: string): number {
  let highest = 0
  for (const number of numbers) {
    const sequence = invoiceSequenceOf(number, scheme)
    if (sequence !== null && sequence > highest) highest = sequence
  }
  return highest + 1
}
