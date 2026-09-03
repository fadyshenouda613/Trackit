import { useState, type JSX } from 'react'
import { ledger } from '../bridge'
import { SettingsRow, SettingsSection } from './SettingsRow'
import { dbPathFor } from './settings-data'

/**
 * Where the work lives, how to get a copy of it, and — kept apart from both —
 * how to destroy it.
 *
 * The destructive action follows the app's rule for destructive actions: never
 * a solid red button, and confirmed in place rather than in a second dialog
 * that appears on top of the one you were already reading.
 */
export function SettingsData(): JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const path = dbPathFor(ledger.platform)

  return (
    <SettingsSection
      title="Data"
      note="Everything Trackit knows is one file on this machine."
    >
      <SettingsRow label="Database" hint="One file. Copy it and you have copied everything.">
        <div className="settings-path-row">
          <code className="t-mono settings-path">{path}</code>
          {/* Inert: revealing a folder needs shell.showItemInFolder over IPC. */}
          <button type="button" className="button">
            Reveal in folder
          </button>
        </div>
      </SettingsRow>

      <SettingsRow
        label="Export"
        hint="One JSON file with every client, project, time entry, invoice and payment."
      >
        {/* Inert: writing a file needs a save dialog over IPC. */}
        <button type="button" className="button">
          Export all data
        </button>
      </SettingsRow>

      <div className="settings-danger">
        <div className="settings-danger__rule" />
        <span className="t-overline settings-danger__label">Irreversible</span>

        <SettingsRow
          label="Delete all local data"
          hint="Every client, project, hour and invoice on this machine. There is no undo, and no copy anywhere else unless you exported one."
        >
          {confirming ? (
            <div className="inv-acts__confirm">
              <span className="inv-acts__confirm-text">
                This cannot be undone. Export first if you want a copy.
              </span>
              <div className="inv-acts__confirm-row">
                <button
                  type="button"
                  className="button inv-acts__button"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button inv-acts__button inv-acts__button--danger"
                  onClick={() => setConfirming(false)}
                >
                  Delete everything
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button inv-acts__button inv-acts__button--danger settings-danger__button"
              onClick={() => setConfirming(true)}
            >
              Delete all data
            </button>
          )}
        </SettingsRow>
      </div>
    </SettingsSection>
  )
}
