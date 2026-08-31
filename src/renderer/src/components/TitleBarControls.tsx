import { useEffect, useState, type JSX } from 'react'
import { ledger } from '../bridge'

/**
 * Windows/Linux have no system chrome on a frameless window, so the app draws
 * its own. macOS keeps its traffic lights and renders nothing here.
 */
export function TitleBarControls(): JSX.Element | null {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void ledger.window.isMaximized().then(setMaximized)
    return ledger.window.onMaximizedChanged(setMaximized)
  }, [])

  if (ledger.platform === 'darwin') return null

  return (
    <div className="window-controls no-drag">
      <button
        type="button"
        className="window-controls__button"
        aria-label="Minimise"
        onClick={() => ledger.window.minimize()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>

      <button
        type="button"
        className="window-controls__button"
        aria-label={maximized ? 'Restore' : 'Maximise'}
        onClick={() => ledger.window.toggleMaximize()}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
            <path d="M2.5 2.5V0.5H9.5V7.5H7.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>

      <button
        type="button"
        className="window-controls__button window-controls__button--close"
        aria-label="Close"
        onClick={() => ledger.window.close()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1" />
          <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  )
}
