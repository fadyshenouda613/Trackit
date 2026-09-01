import { useState, type JSX } from 'react'
import { Icon } from './Icon'
import { startableProjects } from './time-data'

type TimerStarterProps = {
  onStart?: (project: string) => void
}

/**
 * Pick and go. The picker is deliberately next to the button rather than inside
 * a dialog: starting a timer is the one thing on this screen that should cost a
 * single click once the project is right.
 */
export function TimerStarter({ onStart }: TimerStarterProps): JSX.Element {
  const [project, setProject] = useState(startableProjects[0])

  return (
    <div className="timer-starter no-drag">
      <div className="timer-starter__pick">
        <select
          className="timer-starter__select truncate"
          value={project}
          aria-label="Project to time"
          onChange={(event) => setProject(event.target.value)}
        >
          {startableProjects.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Icon name="caret" size={11} className="timer-starter__caret" />
      </div>

      <button
        type="button"
        className="button button--primary timer-starter__start"
        onClick={() => onStart?.(project)}
      >
        <Icon name="play" size={11} />
        Start
      </button>
    </div>
  )
}
