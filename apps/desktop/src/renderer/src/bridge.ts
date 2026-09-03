import type { LedgerApi } from '../../shared/api'

/**
 * The preload bridge, with a no-op stand-in for when the renderer is opened
 * directly in a browser (Vite's dev URL) rather than inside the Electron shell.
 * Without it every window-control call would throw outside the app.
 */
const detached: LedgerApi = {
  platform: 'win32',
  window: {
    minimize: () => undefined,
    toggleMaximize: () => undefined,
    close: () => undefined,
    isMaximized: () => Promise.resolve(false),
    onMaximizedChanged: () => () => undefined,
    setTheme: () => undefined
  }
}

export const ledger: LedgerApi =
  typeof window !== 'undefined' && window.ledger ? window.ledger : detached

/** True when running inside Electron, i.e. the window has its own chrome. */
export const isDesktop = typeof window !== 'undefined' && Boolean(window.ledger)
