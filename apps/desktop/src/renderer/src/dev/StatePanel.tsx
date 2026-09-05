import { useState, type JSX } from 'react'
import type { SyncState } from '../components/sync-data'
import type { Theme } from '../components/theme'
import type { ToastKind } from '../components/toast-data'

export type Screen =
  | 'dashboard'
  | 'clients'
  | 'client'
  | 'projects'
  | 'project'
  | 'time'
  | 'newInvoice'
  | 'invoices'
  | 'invoice'
  | 'settings'
  | 'printed'

/**
 * Which account card is showing instead of the app. `null` means the app itself
 * is. Not part of `Screen`, because these are not screens of the app — they are
 * what stands in front of it, the same way the timer and sync states below are
 * conditions rather than places.
 */
export type AuthView = 'signIn' | 'signUp' | 'welcome' | 'offline'

/**
 * Off, running, and running past the budget. The third is a state of the timer
 * bar rather than of any screen, and nothing in the app's own navigation can
 * reach it.
 */
export type TimerState = 'off' | 'running' | 'over'

/**
 * Which non-modal notice is up. Its own axis rather than part of `Screen`,
 * because a notice is a condition of a record and not a place: the same
 * project screen is the one that shows it and the one that does not.
 */
export type NoticeState = 'none' | 'conflict' | 'reorder' | 'update'

/**
 * Whether the tables have their rows yet. Loading is the real query state; this
 * switch forces it so the skeletons stay reviewable — a local database answers
 * fast enough that nobody would otherwise see one.
 */
export type DataState = 'ready' | 'loading'

/** Dialogs are states of a screen, not screens of their own. */
export type Modal = null | 'client' | 'project' | 'payment'

/**
 * Everything the Screen row can ask for. Wider than `Screen` because some of
 * its entries are not places: `empty` and `seed` are what the database holds,
 * the dialogs are states of a screen, and `recovery` is a condition the app
 * finds at launch.
 */
type ScreenChoice =
  | Screen
  | 'empty'
  | 'seed'
  | 'newClient'
  | 'newProject'
  | 'recovery'
  | 'voidInvoice'
  | 'payment'

/** `in` is the way back to the app; the rest map straight to an `AuthView`. */
type AccountChoice = 'in' | AuthView

type StatePanelProps = {
  screen: Screen
  modal: Modal
  /** Whether the database is empty, which is what the Screen row calls 'empty'. */
  isEmpty: boolean
  onScreen: (choice: ScreenChoice) => void
  authView: AuthView | null
  onAuthView: (view: AuthView | null) => void
  timer: TimerState
  onTimer: (timer: TimerState) => void
  syncState: SyncState
  onSyncState: (state: SyncState) => void
  notice: NoticeState
  onNotice: (notice: NoticeState) => void
  data: DataState
  onData: (data: DataState) => void
  /* A toast is an event, not a state: there is nothing to switch to, only
     something to set off. So this axis fires rather than selects. */
  onToast: (kind: ToastKind) => void
  theme: Theme
  onTheme: (theme: Theme) => void
  /**
   * Whether the levers that write to the database are there to pull. They are
   * registered only in a development build, so in a packaged one the options
   * that need them say why they cannot be used rather than failing when they
   * are.
   */
  devAvailable: boolean
}

type OptionRowProps<T extends string> = {
  label: string
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (value: T) => void
}

function OptionRow<T extends string>({
  label,
  value,
  options,
  onChange
}: OptionRowProps<T>): JSX.Element {
  return (
    <div className="state-panel__row">
      <span className="state-panel__label">{label}</span>
      <div className="state-panel__options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              option.value === value
                ? 'state-panel__option state-panel__option--on'
                : 'state-panel__option'
            }
            disabled={option.disabled}
            title={option.disabled ? 'Development build only' : undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Stands in for the artboards' `frame` and `timerRunning` props so every state
 * the design specifies stays reachable, including the ones the app's own
 * navigation cannot reach (the empty account).
 */
export function StatePanel(props: StatePanelProps): JSX.Element {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className="state-panel__handle" onClick={() => setOpen(true)}>
        States
      </button>
    )
  }

  return (
    <div className="state-panel">
      <div className="state-panel__head">
        <span className="t-overline state-panel__title">States</span>
        <div className="spacer" />
        <button type="button" className="state-panel__close" onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>

      <OptionRow
        label="Screen"
        value={
          props.modal === 'client'
            ? 'newClient'
            : props.modal === 'project'
              ? 'newProject'
              : props.modal === 'payment'
                ? 'payment'
                : /* Empty is not a screen of its own any more: it is the
                     dashboard with an empty database behind it. */
                  props.isEmpty && props.screen === 'dashboard'
                  ? 'empty'
                  : props.screen
        }
        onChange={props.onScreen}
        options={[
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'empty', label: 'Empty', disabled: !props.devAvailable },
          { value: 'seed', label: 'Seed', disabled: !props.devAvailable },
          { value: 'clients', label: 'Clients' },
          { value: 'client', label: 'Detail' },
          { value: 'newClient', label: 'New client' },
          { value: 'projects', label: 'Projects' },
          { value: 'project', label: 'Project' },
          { value: 'newProject', label: 'New project' },
          { value: 'time', label: 'Time' },
          { value: 'recovery', label: 'Recovery', disabled: !props.devAvailable },
          { value: 'newInvoice', label: 'New invoice' },
          { value: 'invoices', label: 'Invoices' },
          { value: 'invoice', label: 'Invoice' },
          { value: 'voidInvoice', label: 'Void invoice' },
          { value: 'payment', label: 'Record payment' },
          { value: 'settings', label: 'Settings' },
          { value: 'printed', label: 'Printed invoice' }
        ]}
      />

      {/*
       * Its own row rather than four more entries above, because "which screen"
       * and "signed in or not" are two questions, and the screen row already
       * asks a long one. Switching here only changes what is drawn — it never
       * touches the stored session, so the sign-up card can be inspected from
       * inside a signed-in app and left again with nothing changed.
       */}
      <OptionRow
        label="Account"
        value={props.authView ?? 'in'}
        onChange={(choice: AccountChoice) => props.onAuthView(choice === 'in' ? null : choice)}
        options={[
          { value: 'in', label: 'In' },
          { value: 'signIn', label: 'Sign in' },
          { value: 'signUp', label: 'Sign up' },
          { value: 'welcome', label: 'Welcome' },
          { value: 'offline', label: 'Offline' }
        ]}
      />

      <OptionRow
        label="Timer"
        value={props.timer}
        onChange={props.onTimer}
        /* Stopping is something the app itself can do; starting a clock on the
           sample project, or on one already over its budget, is staged. */
        options={[
          { value: 'off', label: 'Stopped' },
          { value: 'running', label: 'Running', disabled: !props.devAvailable },
          { value: 'over', label: 'Over budget', disabled: !props.devAvailable }
        ]}
      />

      <OptionRow
        label="Sync"
        value={props.syncState}
        onChange={props.onSyncState}
        options={[
          { value: 'saved', label: 'Saved' },
          { value: 'syncing', label: 'Syncing' },
          { value: 'pending', label: 'Pending' },
          { value: 'failed', label: 'Failed' }
        ]}
      />

      {/* The first two need the project screen to be visible to show anything;
          the update notice appears on whichever screen you are already on. */}
      <OptionRow
        label="Notice"
        value={props.notice}
        onChange={props.onNotice}
        options={[
          { value: 'none', label: 'None' },
          { value: 'conflict', label: 'Conflict' },
          { value: 'reorder', label: 'Reorder' },
          { value: 'update', label: 'Update' }
        ]}
      />

      <OptionRow
        label="Data"
        value={props.data}
        onChange={props.onData}
        options={[
          { value: 'ready', label: 'Ready' },
          { value: 'loading', label: 'Loading' }
        ]}
      />

      <div className="state-panel__row">
        <span className="state-panel__label">Toast</span>
        <div className="state-panel__options">
          {(
            [
              { value: 'pdf', label: 'PDF' },
              { value: 'payment', label: 'Payment' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'timer', label: 'Timer' },
              { value: 'error', label: 'Error' }
            ] as { value: ToastKind; label: string }[]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              className="state-panel__option"
              onClick={() => props.onToast(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <OptionRow
        label="Theme"
        value={props.theme}
        onChange={props.onTheme}
        options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
          { value: 'system', label: 'System' }
        ]}
      />
    </div>
  )
}
