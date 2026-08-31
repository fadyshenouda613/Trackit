import type { JSX } from 'react'
import { TitleBarControls } from './TitleBarControls'

/**
 * "Spans the full window above everything and only exists while a timer runs."
 * When it is absent the top bar takes over the window-drag duty.
 */
export function TimerBar(): JSX.Element {
  return (
    <div className="timer-bar drag">
      <div className="timer-bar__recording">
        <div className="timer-bar__dot pulse" />
        <span className="t-overline timer-bar__label">Recording</span>
      </div>

      <div className="timer-bar__divider" />

      <span className="timer-bar__project">Northwind — Brand refresh</span>
      <span className="timer-bar__meta">Deliverable: Logo lockups</span>

      <div className="spacer" />

      <span className="timer-bar__meta num">28h 15m of 32h budget</span>
      <span className="timer-bar__elapsed">01:24:36</span>

      <button type="button" className="timer-bar__stop no-drag">
        <span className="timer-bar__stop-glyph" />
        Stop
      </button>

      <TitleBarControls />
    </div>
  )
}
