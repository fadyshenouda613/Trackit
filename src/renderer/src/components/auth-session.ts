/*
 * What the app remembers about being signed in.
 *
 * The stated promise is that an account is only needed the first time, so the
 * session has to outlive the window — it is the one thing in this app that
 * survives a reload. It is kept in localStorage rather than a file in the main
 * process because the renderer is also opened straight at Vite's dev URL, where
 * there is no main process to ask (see bridge.ts): a file store would silently
 * never persist there, and the front door would behave differently in the two
 * ways this app is run.
 */

export type Session = {
  /** What Settings' "Signed in as" states — whatever was typed in the Email field. */
  email: string
  /** Taken at sign-up. Empty for a sign-in, which never asks for it. */
  name: string
  /** Bumped if this shape changes, so an old record is discarded, not crashed on. */
  version: 1
}

/*
 * Two keys, because they have two lifetimes: signing out forgets the session and
 * must not forget the welcome screen. Signing back in is not a first run.
 */
const SESSION_KEY = 'trackit.session'
const WELCOME_KEY = 'trackit.welcome-seen'

/*
 * A stand-in. Signing in needs an account service and there is none behind this
 * yet — the same reason Settings' "Sync now" is inert. Until there is, one known
 * pair opens the app, and the sign-in card says so rather than making anyone
 * read this file.
 */
const STAND_IN = { email: 'admin', password: 'admin' }

/** The shortest password sign-up will take. Stated on the card, not just here. */
export const MIN_PASSWORD = 8

/** True when the pair typed is the one that opens the app. */
export function verify(email: string, password: string): boolean {
  return email.trim().toLowerCase() === STAND_IN.email && password === STAND_IN.password
}

/*
 * Every access is guarded. localStorage throws outright rather than returning
 * null in a few embedded contexts, and a storage failure should cost someone a
 * sign-in, never a blank window.
 */
export function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    /* An unrecognised version is a record this build cannot read, so it is
       treated as no record at all rather than half-trusted. */
    if (parsed.version !== 1 || typeof parsed.email !== 'string') return null
    return { version: 1, email: parsed.email, name: parsed.name ?? '' }
  } catch {
    return null
  }
}

export function writeSession(session: Session): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* Nothing to do and nothing worth saying: the app still works, it will just
       ask again next launch. */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    /* As above. */
  }
}

/** The welcome screen is shown once per machine, not once per sign-in. */
export function hasSeenWelcome(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_KEY) === 'yes'
  } catch {
    /* Unreadable storage means it is safer to skip the welcome than to show it
       on every launch. */
    return true
  }
}

export function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(WELCOME_KEY, 'yes')
  } catch {
    /* As above. */
  }
}
