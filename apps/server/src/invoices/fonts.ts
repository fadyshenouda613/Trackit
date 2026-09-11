import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

/*
 * The sheet's typeface, embedded.
 *
 * The desktop bundles IBM Plex Sans; a page printed by a headless browser
 * on a server has no bundle and no network it should depend on, so the
 * variable cut is read from the package once and written into the page as
 * a data URL. One face covers every weight the sheet uses.
 */

const FONT_FILE = '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2'

let cached: string | null = null

/** The `@font-face` rule for the sheet, with the file inside it. Read once. */
export function invoiceFontCss(): string {
  if (cached !== null) return cached
  const require = createRequire(import.meta.url)
  const woff2 = readFileSync(require.resolve(FONT_FILE)).toString('base64')
  cached = `@font-face {
  font-family: 'IBM Plex Sans Variable';
  font-style: normal;
  font-display: block;
  font-weight: 100 700;
  src: url(data:font/woff2;base64,${woff2}) format('woff2');
}`
  return cached
}
