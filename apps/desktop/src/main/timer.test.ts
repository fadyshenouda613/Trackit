import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from './db'
import { createTimeEntry, runningTimeEntry, startTimer } from './repositories'
import { aClient, aProject, id } from './repositories/test-support'
import { toggleTimer, trayState } from './timer'

let db: Database
beforeEach(() => {
  db = openMemoryDatabase()
})

const T0 = '2026-09-04T16:10:00.000Z'
const T1 = '2026-09-04T17:34:36.000Z'

describe('trayState', () => {
  it('names the project and client and computes elapsed from the start', () => {
    const project = aProject(db, aClient(db, { company: 'Northwind Studio' }), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    expect(trayState(db, Date.parse(T1))).toEqual({
      running: true, project: 'Brand refresh', client: 'Northwind Studio', elapsedSeconds: 5076
    })
  })

  it('offers the last project when idle, or nothing on an empty log', () => {
    expect(trayState(db, Date.parse(T1))).toEqual({ running: false, lastProject: '' })
    const project = aProject(db, aClient(db), 'active')
    createTimeEntry(db, { id: id(), projectId: project.id, checklistItemId: null, note: '', startedAt: T0, endedAt: T1, source: 'timer' })
    expect(trayState(db, Date.parse(T1))).toEqual({ running: false, lastProject: 'Brand refresh' })
  })
})

describe('toggleTimer', () => {
  it('stops a running clock', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    expect(toggleTimer(db, T1)?.endedAt).toBe(T1)
    expect(runningTimeEntry(db)).toBeNull()
  })

  it('restarts the last project when idle', () => {
    const project = aProject(db, aClient(db), 'active')
    createTimeEntry(db, { id: id(), projectId: project.id, checklistItemId: null, note: '', startedAt: T0, endedAt: T1, source: 'timer' })
    const started = toggleTimer(db, '2026-09-04T18:00:00.000Z')
    expect(started?.projectId).toBe(project.id)
    expect(started?.endedAt).toBeNull()
  })

  it('does nothing with no project to restart', () => {
    expect(toggleTimer(db, T1)).toBeNull()
  })
})
