import { useState, type JSX, type ReactNode } from 'react'
import { Logo } from './Logo'
import { TitleBarControls } from './TitleBarControls'
import { MIN_PASSWORD, verify } from './auth-session'
import { toneVar } from './tone'
import type { AuthView } from '../dev/StatePanel'

/*
 * The front door, and the two states either side of it.
 *
 * All four are one centred card in the app's own window rather than a page: this
 * is a desktop app someone has already installed, so there is nothing left to
 * sell and no reason to fill 1440px. The card is the dialog recipe without the
 * head and foot bars — a surface in Trackit, not a login page laid on top of one.
 *
 * These screens return before the app shell, which means they also return before
 * TopBar — the app's only drag region. So the frame below draws the window
 * chrome itself; without it a frameless window cannot be moved or closed.
 */

/** The lockup and the one line about what the app is. On every state. */
function Masthead(): JSX.Element {
  return (
    <>
      <div className="auth__lockup">
        <Logo size={26} />
        {/* HTML text, never outlines — the same wordmark the sidebar sets. */}
        <h1 className="auth__wordmark">Trackit</h1>
      </div>
      <p className="auth__lede">
        Track hours against fixed prices and see what you are really earning an hour.
      </p>
    </>
  )
}

type FieldProps = {
  id: string
  label: string
  type?: string
  value: string
  autoFocus?: boolean
  onChange: (value: string) => void
}

/**
 * Label stacked over field, as the dialogs do it. Settings stacks the other way
 * because it is an inventory; this is one task.
 */
function Field({ id, label, type = 'text', value, autoFocus, onChange }: FieldProps): JSX.Element {
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className={value ? 'field field--filled' : 'field'}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}

/**
 * The composite-field recipe from the money and hours fields: the border sits on
 * the wrapper and the input goes bare inside it, which leaves room for the
 * reveal.
 *
 * That reveal is the word "Show" and not an eye, because the icon set has none
 * and one glyph drawn for one control would be the only icon in the app without
 * a second use.
 */
function PasswordField({ id, label, value, onChange }: PasswordFieldProps): JSX.Element {
  const [shown, setShown] = useState(false)

  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      <div className={value ? 'field field--filled auth__password' : 'field auth__password'}>
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          className="auth__password-input"
          value={value}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="auth__reveal"
          aria-label={shown ? 'Hide password' : 'Show password'}
          onClick={() => setShown((current) => !current)}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}

type NoteProps = {
  children: ReactNode
  /**
   * A correction reads one step brighter than a hint so it registers as a
   * change. It is still grey: the app states refusals in prose and leaves the
   * field armed, because a wrong password is a correction and not a failure.
   */
  correction?: boolean
}

/** Always rendered, so nothing above it moves when the sentence changes. */
function Note({ children, correction }: NoteProps): JSX.Element {
  return (
    <p className={correction ? 'auth__note auth__note--correction' : 'auth__note'}>{children}</p>
  )
}

type SignInProps = {
  onSignIn: (email: string) => void
  onSignUp: () => void
}

function SignInCard({ onSignIn, onSignUp }: SignInProps): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rejected, setRejected] = useState(false)

  const ready = email.trim() !== '' && password !== ''

  const submit = (): void => {
    if (!ready) return
    if (verify(email, password)) {
      onSignIn(email.trim())
    } else {
      /* The fields stay as they are. Clearing them would make a typo cost the
         whole entry. */
      setRejected(true)
    }
  }

  return (
    <form
      className="auth__card"
      /*
       * The browser must not validate this. Its own bubble is a light-mode
       * tooltip drawn outside the app's type and colour, and this card states
       * its refusals in grey prose beneath the field like everything else does.
       * It would also have made the stand-in unusable: `admin` is not an email
       * address, so constraint validation refused to submit the form at all.
       */
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Masthead />
      <div className="dialog__rule" />

      <span className="t-overline auth__step">Sign in</span>

      <Field
        id="auth-email"
        label="Email"
        type="email"
        value={email}
        autoFocus
        onChange={(next) => {
          setEmail(next)
          setRejected(false)
        }}
      />
      <PasswordField
        id="auth-password"
        label="Password"
        value={password}
        onChange={(next) => {
          setPassword(next)
          setRejected(false)
        }}
      />

      <Note correction={rejected}>
        {rejected
          ? 'That email and password do not match. Check both and try again.'
          : 'No account service is connected yet — admin / admin signs you in.'}
      </Note>

      <button type="submit" className="auth__submit" disabled={!ready}>
        Sign in
      </button>

      <span className="auth__switch">
        New here?{' '}
        <button type="button" className="auth__link" onClick={onSignUp}>
          Create an account
        </button>
      </span>

      <span className="auth__aside">
        You only need an account the first time. After that Trackit opens straight into your
        work, with or without a connection.
      </span>
    </form>
  )
}

type SignUpProps = {
  onSignUp: (name: string, email: string) => void
  onSignIn: () => void
}

function SignUpCard({ onSignUp, onSignIn }: SignUpProps): JSX.Element {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const longEnough = password.length >= MIN_PASSWORD
  const short = password !== '' && !longEnough
  const ready = name.trim() !== '' && email.trim() !== '' && longEnough

  return (
    <form
      className="auth__card"
      /* As on the sign-in card: this app draws its own corrections. */
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) onSignUp(name.trim(), email.trim())
      }}
    >
      <Masthead />
      <div className="dialog__rule" />

      <span className="t-overline auth__step">Create an account</span>

      {/* Name first: it is the thing the app will call you. */}
      <Field id="auth-name" label="Name" value={name} autoFocus onChange={setName} />
      <Field id="auth-email" label="Email" type="email" value={email} onChange={setEmail} />
      <PasswordField id="auth-password" label="Password" value={password} onChange={setPassword} />

      {/*
       * The one requirement, stated before it is broken and corrected in place
       * afterwards — the primary stays disabled until it is met, which is how
       * the timer recovery dialog handles a value it cannot accept.
       */}
      <Note correction={short}>
        {short
          ? 'That is ' + password.length + ' characters. Use at least ' + MIN_PASSWORD + '.'
          : 'At least ' + MIN_PASSWORD + ' characters.'}
      </Note>

      <button type="submit" className="auth__submit" disabled={!ready}>
        Create account
      </button>

      <span className="auth__switch">
        Already have an account?{' '}
        <button type="button" className="auth__link" onClick={onSignIn}>
          Sign in
        </button>
      </span>

      <span className="auth__aside">
        Your work stays on this machine. The account is only so you can sign back in.
      </span>
    </form>
  )
}

/**
 * One screen, one sentence, one action.
 *
 * Not a carousel: nothing here is worth three screens of anyone's attention
 * before they have entered a single client, and a tour of features they have no
 * data for teaches nothing.
 */
function WelcomeCard({ onEnterApp }: { onEnterApp: () => void }): JSX.Element {
  return (
    <div className="auth__card auth__card--welcome">
      <div className="auth__lockup">
        <Logo size={26} />
        <h1 className="auth__wordmark">Trackit</h1>
      </div>

      {/* t-heading, not t-title: the empty dashboard this hands you to sets its
          heading at 26px, and the card before it should not out-shout it. */}
      <h2 className="t-heading">Trackit is set up</h2>
      <p className="auth__lede">
        Everything lives on this machine and works without a connection — start by adding
        whoever is paying you.
      </p>

      {/* Deliberately the same button, with the same shortcut chip, as the one
          waiting on the screen behind this one. */}
      <button type="button" className="auth__cta" onClick={onEnterApp}>
        Add your first client
        <span className="empty__kbd">⌘N</span>
      </button>
    </div>
  )
}

/**
 * No connection and no session, so the front door cannot open yet.
 *
 * Warning-toned rather than negative, and phrased as a fact rather than a
 * failure: offline is a state this app is built to live in, and the only thing
 * wrong here is the timing.
 */
function OfflineCard({ onRetry }: { onRetry: () => boolean }): JSX.Element {
  const [checked, setChecked] = useState<string | null>(null)

  return (
    <div className="auth__card">
      <div className="auth__lockup">
        <Logo size={26} />
        <h1 className="auth__wordmark">Trackit</h1>
      </div>

      {/* The dot and overline pair the sidebar footer uses, so offline looks the
          same here as it does everywhere else in the app. */}
      <div className="auth__state">
        <div className="dot" style={{ background: toneVar.warning }} aria-hidden="true" />
        <span className="t-overline">No connection</span>
      </div>

      <h2 className="t-subhead">First sign-in needs a connection</h2>
      <p className="auth__lede">
        Trackit has to reach your account once to set this machine up. After that it opens
        straight into your work and keeps working offline.
      </p>

      {/*
       * Retry has to say what it found. There is no service to reach, so all it
       * can honestly check is whether the machine has a link at all — and a
       * button that looks like it did nothing is worse than one that admits it
       * found nothing.
       */}
      <Note correction={checked !== null}>
        {checked ?? 'Nothing is lost while you wait — there is nothing here yet to lose.'}
      </Note>

      <button
        type="button"
        className="auth__submit"
        onClick={() => {
          if (onRetry()) return
          setChecked(
            /* 24-hour, because every other time in the app is: the sidebar
               footer states the last sync as 14:02. */
            'Still no connection. Last checked ' +
              new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }) +
              '.'
          )
        }}
      >
        Try again
      </button>
    </div>
  )
}

type AuthScreenProps = {
  view: AuthView
  onView: (view: AuthView) => void
  onSignIn: (email: string) => void
  onSignUp: (name: string, email: string) => void
  /** Returns whether there is a connection now, so the card can say either way. */
  onRetry: () => boolean
  /** The welcome card's single action: into the app, on the empty dashboard. */
  onEnterApp: () => void
}

export function AuthScreen({
  view,
  onView,
  onSignIn,
  onSignUp,
  onRetry,
  onEnterApp
}: AuthScreenProps): JSX.Element {
  return (
    <div className="auth">
      {/*
       * The whole of the window chrome on these screens. Same height and insets
       * as the top bar it stands in for, including the gap macOS traffic lights
       * sit in, but with no bottom rule: there is nothing below it to divide.
       */}
      <div className="auth__chrome drag">
        <div className="spacer" />
        <TitleBarControls />
      </div>

      <div className="auth__stage">
        {view === 'signIn' && <SignInCard onSignIn={onSignIn} onSignUp={() => onView('signUp')} />}
        {view === 'signUp' && <SignUpCard onSignUp={onSignUp} onSignIn={() => onView('signIn')} />}
        {view === 'welcome' && <WelcomeCard onEnterApp={onEnterApp} />}
        {view === 'offline' && <OfflineCard onRetry={onRetry} />}
      </div>
    </div>
  )
}
