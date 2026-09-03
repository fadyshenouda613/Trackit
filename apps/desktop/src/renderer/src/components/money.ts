/**
 * Money, formatted and read back.
 *
 * Two screens now type figures into a field and show a total derived from them,
 * so the formatting lives in one place: two places to format money would be two
 * places for it to disagree.
 */

/** Symbols the app's currency list can produce, so a typed figure parses back. */
const SYMBOLS = /[$£€\s,]/g

/**
 * Always two decimals — an invoice line reading "$1,200" looks unfinished. The
 * symbol is a parameter because a client is billed in their own currency, and a
 * total printed in dollars under a line that says GBP is simply wrong.
 */
export const money = (value: number, symbol = '$'): string =>
  `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Strips the symbol and the grouping commas a price is typed with. */
export const parseMoney = (raw: string): number | null => {
  const cleaned = raw.replace(SYMBOLS, '').trim()
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}
