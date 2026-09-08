import { useEffect, useState, type JSX } from 'react'
import type { Id, Project } from '@trackit/shared'
import { Icon } from './Icon'

type TimerStarterProps = {
  projects: Project[]
  onStart?: (projectId: Id) => void
}

/**
 * Pick and go. The picker is deliberately next to the button rather than inside
 * a dialog: starting a timer is the one thing on this screen that should cost a
 * single click once the project is right.
 */
export function TimerStarter({ projects, onStart }: TimerStarterProps): JSX.Element {
  const [project, setProject] = useState<Id | ''>(projects[0]?.id ?? '')

  /* The list starts empty while the query is in flight; adopt the first
     project once it lands rather than leaving the picker stuck blank. */
  useEffect(() => {
    if (project === '' && projects[0]) setProject(projects[0].id)
  }, [project, projects])

  return (
    <div className="timer-starter no-drag">
      <div className="timer-starter__pick">
        <select
          className="timer-starter__select truncate"
          value={project}
          aria-label="Project to time"
          onChange={(event) => setProject(event.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Icon name="caret" size={11} className="timer-starter__caret" />
      </div>

      <button
        type="button"
        className="button button--primary timer-starter__start"
        disabled={!project}
        onClick={() => project && onStart?.(project)}
      >
        <Icon name="play" size={11} />
        Start
      </button>
    </div>
  )
}
