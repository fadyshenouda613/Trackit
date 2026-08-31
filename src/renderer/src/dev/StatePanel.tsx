import { useState, type JSX } from 'react'
import type { SyncState } from '../components/SyncStatus'

export type Screen = 'dashboard' | 'empty' | 'clients' | 'client' | 'projects'
export type Theme = 'dark' | 'light'

/** Dialogs are states of a screen, not screens of their own. */
export type Modal = null | 'client' | 'project'

type ScreenChoice = Screen | 'newClient' | 'newProject'

type StatePanelProps = {
  screen: Screen
  modal: Modal
  onScreen: (choice: ScreenChoice) => void
  timerRunning: boolean
  onTimerRunning: (running: boolean) => void
  syncState: SyncState
  onSyncState: (state: SyncState) => void
  theme: Theme
  onTheme: (theme: Theme) => void
}

type OptionRowProps<T extends string> = {
  label: string
  value: T
  options: { value: T; label: string }[]
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
              : props.screen
        }
        onChange={props.onScreen}
        options={[
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'empty', label: 'Empty' },
          { value: 'clients', label: 'Clients' },
          { value: 'client', label: 'Detail' },
          { value: 'newClient', label: 'New client' },
          { value: 'projects', label: 'Projects' },
          { value: 'newProject', label: 'New project' }
        ]}
      />

      <OptionRow
        label="Timer"
        value={props.timerRunning ? 'on' : 'off'}
        onChange={(value) => props.onTimerRunning(value === 'on')}
        options={[
          { value: 'on', label: 'Running' },
          { value: 'off', label: 'Stopped' }
        ]}
      />

      <OptionRow
        label="Sync"
        value={props.syncState}
        onChange={props.onSyncState}
        options={[
          { value: 'saved', label: 'Saved' },
          { value: 'syncing', label: 'Syncing' },
          { value: 'offline', label: 'Offline' }
        ]}
      />

      <OptionRow
        label="Theme"
        value={props.theme}
        onChange={props.onTheme}
        options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' }
        ]}
      />
    </div>
  )
}
