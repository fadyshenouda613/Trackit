/*
 * Which theme the app is in, and what it remembers about that.
 *
 * A preference, not a state. "System" is a standing instruction to follow the
 * OS rather than a third palette, so what the stylesheet is handed is always
 * one of the two real themes — that is what `resolve` is for, and why nothing
 * outside this file writes `data-theme` itself.
 *
 * Kept in localStorage for the reason auth-session.ts gives for the session:
 * the renderer is also opened straight at Vite's dev URL, where there is no
 * main process to ask (see bridge.ts), and a file store would silently never
 * persist there. It is read a second time by public/theme-boot.js, before the
 * first paint — that file has to agree with this one about the key and the
 * three spellings, and says so.
 */

/** What the stylesheet understands: the two blocks in tokens.css. */
export type ResolvedTheme = 'dark' | 'light'

/** What someone can choose. */
export type Theme = ResolvedTheme | 'system'

/* Duplicated as a literal in public/theme-boot.js, which runs before any module
   graph exists and so cannot import it. Changing it means changing both. */
const THEME_KEY = 'trackit.theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/*
 * Guarded the way auth-session.ts guards localStorage, and for the same reason:
 * matchMedia is missing or throws in a few embedded contexts, and an unreadable
 * preference should cost someone the right theme, never a blank window. Dark is
 * the fallback because it is the theme the app is designed in.
 */
export function prefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches
  } catch {
    return true
  }
}

/** The preference, answered as something the stylesheet can be given. */
export function resolve(theme: Theme): ResolvedTheme {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme
}

export function readTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_KEY)
    /* Anything else is a record this build cannot read — an older spelling, or
       a hand-edited value — and is treated as no record at all. */
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw
    return 'system'
  } catch {
    return 'system'
  }
}

export function writeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* Nothing to do and nothing worth saying: the app still works, it will just
       start on the system's preference next launch. */
  }
}

/**
 * Calls back when the OS flips between light and dark. Only worth subscribing
 * to while the preference is "system"; returns an unsubscribe function.
 */
export function watchSystem(onChange: () => void): () => void {
  try {
    const query = window.matchMedia(DARK_QUERY)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  } catch {
    return () => undefined
  }
}
