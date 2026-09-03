/*
 * Stamps data-theme on <html> before anything paints.
 *
 * A classic, non-deferred script rather than an inline one: the page's CSP is
 * `script-src 'self'` with no 'unsafe-inline', so an inline block would be
 * refused and the app would start on the wrong theme every launch. Being
 * classic and in the <head> is the point — it blocks parsing and runs before
 * the first paint, where a module script would not.
 *
 * It duplicates three things from src/components/theme.ts, which it cannot
 * import because no module graph exists yet: the storage key, the three
 * spellings of the preference, and the rule that anything else means "system".
 * Changing them there means changing them here.
 */
;(function () {
  try {
    var stored = window.localStorage.getItem('trackit.theme')
    if (stored !== 'dark' && stored !== 'light' && stored !== 'system') stored = 'system'

    var resolved = stored
    if (stored === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    document.documentElement.dataset.theme = resolved
  } catch (error) {
    /* Unreadable storage or no matchMedia. Dark is the theme the app is
       designed in, so it is what an unanswerable question falls back to. */
    document.documentElement.dataset.theme = 'dark'
  }
})()
