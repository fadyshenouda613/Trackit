import { randomUUID } from 'node:crypto'
import { elapsedSeconds } from '@trackit/shared/helpers'
import type { TimeEntry } from '@trackit/shared/schemas'
import { nowIso } from './db/clock'
import type { Database } from './db'
import {
  getClient,
  getProject,
  latestTimeEntry,
  runningTimeEntry,
  startTimer,
  stopTimer
} from './repositories'
import type { TrayTimerState } from './tray'

/*
 * The timer as the tray sees it. Nothing is kept here: every call reads the
 * running row and measures it against the clock it is handed, so a tray that
 * asks once a second and a renderer that asks on its own schedule agree.
 */

export function trayState(db: Database, nowMs: number): TrayTimerState {
  const running = runningTimeEntry(db)
  if (running) {
    const project = getProject(db, running.projectId)
    const client = project ? getClient(db, project.clientId) : null
    return {
      running: true,
      project: project?.name ?? '',
      client: client?.company ?? '',
      elapsedSeconds: elapsedSeconds(running.startedAt, nowMs)
    }
  }
  const latest = latestTimeEntry(db)
  const project = latest ? getProject(db, latest.projectId) : null
  return { running: false, lastProject: project?.name ?? '' }
}

/** Stop when running, start the last project when not. Null when there is nothing to start. */
export function toggleTimer(db: Database, now: string = nowIso()): TimeEntry | null {
  if (runningTimeEntry(db)) return stopTimer(db, now)
  const latest = latestTimeEntry(db)
  if (!latest) return null
  return startTimer(db, { id: randomUUID(), projectId: latest.projectId, checklistItemId: null, note: '' }, now)
}
