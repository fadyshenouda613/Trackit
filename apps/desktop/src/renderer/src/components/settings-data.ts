/*
 * Settings — the parsers and formatters the screen needs and the store does
 * not provide.
 *
 * The store holds `Settings` as numbers and cents; the screen holds the same
 * figures as typed text while you are in a field, the way every other form in
 * the app does — the field is the truth while you are in it, and the number is
 * read back at the edge. `formFrom` is that edge going one way, the `parse*`
 * functions the other: each returns null on text that cannot commit, so the
 * field keeps what you typed rather than reformatting your keystrokes.
 */

import { formatMoney, parseMoneyToCents, schemeHasCounter, type Settings } from '@trackit/shared'

/** The figures the screen holds as typed text while you are in the field. */
export type SettingsForm = {
  taxRate: string
  paymentTermsDays: string
  rateFloor: string
  numberingScheme: string
}
export const formFrom = (s: Settings): SettingsForm => ({
  taxRate: String(s.taxRate),
  paymentTermsDays: String(s.paymentTermsDays),
  rateFloor: formatMoney(s.rateFloorCents / 100, ''),
  numberingScheme: s.numberingScheme
})
export const parseTaxRate = (t: string): number | null => {
  const n = Number(t.trim())
  return t.trim() && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
}
export const parseTermDays = (t: string): number | null =>
  /^\d+$/.test(t.trim()) ? Number(t.trim()) : null
export const parseRateFloor = (t: string): number | null => {
  const c = parseMoneyToCents(t)
  return c !== null && c >= 0 ? c : null
}
export const parseScheme = (t: string): string | null =>
  schemeHasCounter(t.trim()) ? t.trim() : null

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
