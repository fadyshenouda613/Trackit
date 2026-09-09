import { ApiFailure } from '../data/result'

/*
 * What the renderer keeps about the account, and what it says when a move
 * is refused.
 *
 * The session itself — who is signed in, and the token that proves it —
 * lives in the main process, encrypted with the OS keychain, and the
 * renderer only ever reads its status over the bridge (see use-auth.ts).
 * The one thing kept here is whether the welcome screen has been shown on
 * this machine: a preference of the machine, not of the account, so it is
 * not in the session and survives signing out.
 */

const WELCOME_KEY = 'trackit.welcome-seen'

/*
 * Every access is guarded. localStorage throws outright rather than returning
 * null in a few embedded contexts, and a storage failure should cost someone
 * a welcome screen, never a blank window.
 */

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
    /* Nothing to do and nothing worth saying: the app still works, it will
       just welcome again next time. */
  }
}

/**
 * The sentence a card puts beneath the field when sign-in or sign-up is
 * refused. Each refusal is a fact and then what to do about it, in the
 * card's own grey prose; none names a status code or a host.
 */
export function refusalLine(error: unknown): string {
  const code = error instanceof ApiFailure ? error.code : 'internal'
  switch (code) {
    case 'unauthorized':
      return 'That email and password do not match. Check both and try again.'
    case 'conflict':
      return 'That email already has an account. Sign in with it instead.'
    case 'offline':
      return 'Trackit could not reach your account. Check your connection and try again.'
    case 'rate_limited':
      return 'Too many attempts for now. Wait a minute and try again.'
    case 'validation':
      return 'That does not look like an email address. Check it and try again.'
    case 'detached':
      return 'Signing in needs the desktop app; a browser tab has no account service to reach.'
    default:
      return error instanceof Error && error.message !== ''
        ? error.message
        : 'Something went wrong on the way to your account. Try again.'
  }
}
