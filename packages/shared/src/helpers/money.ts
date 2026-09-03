/**
 * Money, formatted and read back.
 *
 * Stored money is integer cents. Two formatters, because two callers exist:
 * `formatCents` for anything read from a record, and `formatMoney` for the
 * major-unit figure a form field holds while it is being typed. Both go
 * through one place so they can never disagree about the shape of a figure.
 */

/** Symbols the app's currency list can produce, so a typed figure parses back. */
const SYMBOLS = /[$£€\s,]/g

const TWO_DECIMALS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const

/**
 * Always two decimals — an invoice line reading "$1,200" looks unfinished. The
 * symbol is a parameter because a client is billed in their own currency, and a
 * total printed in dollars under a line that says GBP is simply wrong. A
 * negative figure carries its sign ahead of the symbol.
 */
export const formatMoney = (value: number, symbol = '$'): string => {
  const sign = value < 0 ? '-' : ''
  return `${sign}${symbol}${Math.abs(value).toLocaleString('en-US', TWO_DECIMALS)}`
}

/** The same figure from stored cents. */
export const formatCents = (cents: number, symbol = '$'): string =>
  formatMoney(cents / 100, symbol)

/** Strips the symbol and the grouping commas a price is typed with. */
export const parseMoney = (raw: string): number | null => {
  const cleaned = raw.replace(SYMBOLS, '').trim()
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** A major-unit figure as integer cents, rounded to the nearest cent. */
export const toCents = (major: number): number => Math.round(major * 100)

/** A typed figure straight to integer cents, or null when it cannot be read. */
export const parseMoneyToCents = (raw: string): number | null => {
  const value = parseMoney(raw)
  return value === null ? null : toCents(value)
}
