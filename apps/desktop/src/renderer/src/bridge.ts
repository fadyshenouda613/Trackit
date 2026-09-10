import type { DataApi, DevApi, LedgerApi, Result } from '@trackit/shared/api'

/**
 * The preload bridge, with a no-op stand-in for when the renderer is opened
 * directly in a browser (Vite's dev URL) rather than inside the Electron shell.
 * Without it every window-control call would throw outside the app.
 */

const detachedResult: Result<never> = {
  ok: false,
  error: { code: 'detached', message: 'No bridge: the renderer is running outside Electron' }
}

/*
 * Every data method answers "detached". A Proxy rather than fifty stubs: the
 * shape is DataApi's to define, and this stand-in has nothing to add to it.
 */
const detachedGroup = new Proxy(
  {},
  { get: () => (): Promise<Result<never>> => Promise.resolve(detachedResult) }
)
const detachedData = new Proxy({}, { get: () => detachedGroup }) as DataApi

const detached: LedgerApi = {
  platform: 'win32',
  window: {
    minimize: () => undefined,
    toggleMaximize: () => undefined,
    close: () => undefined,
    isMaximized: () => Promise.resolve(false),
    onMaximizedChanged: () => () => undefined,
    setTheme: () => undefined
  },
  data: detachedData,
  timer: {
    onChanged: () => () => undefined
  },
  updates: {
    status: () => Promise.resolve({ ok: true, data: { state: 'disabled', reason: 'No bridge' } }),
    check: () => Promise.resolve({ ok: true, data: { state: 'disabled', reason: 'No bridge' } }),
    install: () => Promise.resolve(detachedResult),
    onChanged: () => () => undefined
  },
  /* Signed out, and every move refused: without a main process there is no
     keychain to keep a session in. */
  auth: {
    status: () => Promise.resolve({ ok: true, data: { state: 'signedOut' } }),
    register: () => Promise.resolve(detachedResult),
    login: () => Promise.resolve(detachedResult),
    logout: () => Promise.resolve(detachedResult),
    onChanged: () => () => undefined
  },
  dev: detachedGroup as DevApi
}

export const ledger: LedgerApi =
  typeof window !== 'undefined' && window.ledger ? window.ledger : detached

/** True when running inside Electron, i.e. the window has its own chrome. */
export const isDesktop = typeof window !== 'undefined' && Boolean(window.ledger)
