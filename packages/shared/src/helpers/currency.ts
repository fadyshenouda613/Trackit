/**
 * The currencies the app offers, with the symbol each one prints under.
 * The codes themselves are the `currencyCodeSchema` enum; this is what a
 * picker lists and what an invoice looks up.
 */
import type { CurrencyCode } from '../schemas/primitives'

export type Currency = { code: CurrencyCode; symbol: string; label: string }

export const currencies: Currency[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'Pound Sterling' },
  { code: 'CAD', symbol: '$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', label: 'Australian Dollar' }
]

export const symbolOf = (code: CurrencyCode): string =>
  currencies.find((entry) => entry.code === code)?.symbol ?? '$'
