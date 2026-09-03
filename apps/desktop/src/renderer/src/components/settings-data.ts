/*
 * Settings — the values the rest of the app is judged against.
 *
 * Held as typed text rather than numbers, the way every other form in the app
 * holds a figure: the field is the truth while you are in it, and the number is
 * read back at the edge with parseMoney. A settings screen that reformats your
 * keystrokes as you make them is a settings screen you cannot type "12" into.
 *
 * Nothing here persists. Like the register and the time log, this is seed data
 * the running app mutates and a reload resets.
 */

import { NEXT_NUMBER } from './invoice-data'
import { business } from './invoices-data'

export type Settings = {
  /* Business profile — what the invoice says about you. */
  person: string
  businessName: string
  address: string
  email: string
  phone: string
  /** A data URL from the file picker, or nothing chosen yet. */
  logo: string | null

  /* Invoicing */
  currency: CurrencyCode
  taxRate: string
  paymentTermsDays: string
  numberingScheme: string

  /* Tracking */
  rateFloor: string
  /** An Electron accelerator, e.g. `CommandOrControl+Shift+S`. */
  shortcut: string

  /* Account */
  accountEmail: string
}

/* ---- Currencies -----------------------------------------------------------
 * Settings keeps its own list rather than sharing the ones inlined in the two
 * client/project dialogs: those pick the currency of one record, this picks the
 * default the pickers start on, and the two lists are free to diverge. */

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD'

export const currencies: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'Pound Sterling' },
  { code: 'CAD', symbol: '$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', label: 'Australian Dollar' }
]

export const symbolOf = (code: CurrencyCode): string =>
  currencies.find((entry) => entry.code === code)?.symbol ?? '$'

/**
 * The default every screen starts from. The business profile is seeded from the
 * constant the invoice already prints from, so the two agree on day one.
 */
export const defaultSettings: Settings = {
  person: business.person,
  businessName: business.name,
  address: business.lines.join('\n'),
  email: business.email,
  phone: '+1 (415) 555-0134',
  logo: null,

  currency: 'USD',
  taxRate: '8.5',
  paymentTermsDays: '14',
  numberingScheme: 'INV-0000',

  rateFloor: '100.00',
  /* Mirrors SHORTCUT in src/main/tray.ts. The renderer cannot import from the
     main process, so the two are kept in step by hand — and changing it here
     changes nothing until there is IPC to re-register the binding. */
  shortcut: 'CommandOrControl+Shift+S',

  accountEmail: 'alex@trackit.studio'
}

/* ---- Invoice numbering ---------------------------------------------------- */

/** The sequence the preview counts from — the number the next invoice takes. */
export const NEXT_SEQUENCE = Number(NEXT_NUMBER.replace(/\D/g, '')) || 150

const YEAR = 2026
const MONTH = 8 // August, matching TODAY in time-data

/**
 * Resolves a numbering scheme to the number the next invoice would carry.
 *
 * A run of zeros is the counter and sets its own padding, so `INV-0000` and
 * `INV-000000` both work and differ only in width. Returns null when there is
 * no counter at all: two invoices sharing a number is worse than a scheme the
 * preview refuses to guess at, so the field says so rather than inventing one.
 */
export function nextInvoiceNumber(scheme: string, sequence = NEXT_SEQUENCE): string | null {
  const zeros = scheme.match(/0+/)
  if (!zeros) return null

  return scheme
    .replace(/\{YYYY\}/g, String(YEAR))
    .replace(/\{YY\}/g, String(YEAR).slice(2))
    .replace(/\{MM\}/g, String(MONTH).padStart(2, '0'))
    .replace(/0+/, String(sequence).padStart(zeros[0].length, '0'))
}

/* ---- Shortcuts ------------------------------------------------------------ */

const MAC_GLYPHS: Record<string, string> = {
  CommandOrControl: '⌘',
  Command: '⌘',
  Control: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧'
}

const PC_NAMES: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  Command: 'Ctrl',
  Control: 'Ctrl',
  Alt: 'Alt',
  Option: 'Alt',
  Shift: 'Shift'
}

/**
 * An accelerator as the platform writes it. macOS stacks glyphs with no
 * separator; everywhere else spells the modifiers out and joins them with a
 * plus, because "⌃⇧S" on Windows is a puzzle rather than a shortcut.
 */
export function formatShortcut(accelerator: string, platform: string): string[] {
  const parts = accelerator.split('+').filter(Boolean)
  if (platform === 'darwin') {
    const modifiers = parts.slice(0, -1).map((part) => MAC_GLYPHS[part] ?? part)
    return [modifiers.join('') + (parts[parts.length - 1] ?? '')]
  }
  return parts.map((part, index) =>
    index === parts.length - 1 ? part : (PC_NAMES[part] ?? part)
  )
}

/* ---- Data ----------------------------------------------------------------- */

/** Where the app would keep its database on each platform. */
export function dbPathFor(platform: string): string {
  if (platform === 'darwin') return '~/Library/Application Support/Trackit/trackit.db'
  if (platform === 'win32') return String.raw`%APPDATA%\Trackit\trackit.db`
  return '~/.config/Trackit/trackit.db'
}
