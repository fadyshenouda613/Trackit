import { beforeEach, describe, expect, it } from 'vitest'
import { totalMinutes } from '@trackit/shared/helpers'
import { openMemoryDatabase, type Database } from './db'
import { createTimeEntry, listTimeEntries, runningTimeEntry, startTimer } from './repositories'
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

describe('trayState arithmetic', () => {
  it('measures from the stored start, so a night asleep changes nothing but the number', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    expect(trayState(db, Date.parse(T0) + 5_000)).toMatchObject({ running: true, elapsedSeconds: 5 })
    expect(trayState(db, Date.parse('2026-09-05T08:00:00.000Z'))).toMatchObject({
      running: true,
      elapsedSeconds: 15 * 3600 + 50 * 60
    })
  })

  it('reads zero, never negative, when the clock has been set back past the start', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    expect(trayState(db, Date.parse(T0) - 60_000)).toMatchObject({ running: true, elapsedSeconds: 0 })
  })

  it('floors to the second: 59.999s reads 59', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    expect(trayState(db, Date.parse(T0) + 59_999)).toMatchObject({ elapsedSeconds: 59 })
  })
})

describe('toggleTimer at the edges', () => {
  it('refuses a stop before the start and leaves the clock running', () => {
    const project = aProject(db, aClient(db), 'active')
    const started = startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T1)
    expect(() => toggleTimer(db, T0)).toThrow(/cannot end before it starts/)
    expect(runningTimeEntry(db)?.id).toBe(started.id)
  })

  it('never starts a second clock: a toggle while running only ever stops', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    expect(toggleTimer(db, T1)?.endedAt).toBe(T1)
    expect(listTimeEntries(db)).toHaveLength(1)
  })

  it('restarts the most recently started project, clean of the last entry\'s note', () => {
    const client = aClient(db)
    const a = aProject(db, client, 'active')
    const b = aProject(db, client, 'active', { name: 'Site build' })
    /* b's entry ends later, but a's started later: the tray offers a. */
    createTimeEntry(db, {
      id: id(), projectId: b.id, checklistItemId: null, note: '', startedAt: T0, endedAt: '2026-09-04T19:00:00.000Z', source: 'manual'
    })
    createTimeEntry(db, {
      id: id(), projectId: a.id, checklistItemId: null, note: 'Logo lockup', startedAt: T1, endedAt: '2026-09-04T18:00:00.000Z', source: 'timer'
    })
    const started = toggleTimer(db, '2026-09-04T20:00:00.000Z')
    expect(started?.projectId).toBe(a.id)
    expect(started?.note).toBe('')
    expect(started?.checklistItemId).toBeNull()
    expect(started?.source).toBe('timer')
    expect(started?.startedAt).toBe('2026-09-04T20:00:00.000Z')
  })

  it('stop, start and stop again leave two rows whose minutes add up with no overlap', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    toggleTimer(db, T1)
    toggleTimer(db, '2026-09-04T18:00:00.000Z')
    toggleTimer(db, '2026-09-04T18:30:00.000Z')
    const entries = listTimeEntries(db)
    expect(entries).toHaveLength(2)
    expect(entries.every((entry) => entry.endedAt !== null)).toBe(true)
    expect(totalMinutes(entries)).toBe(84 + 30)
  })
})
