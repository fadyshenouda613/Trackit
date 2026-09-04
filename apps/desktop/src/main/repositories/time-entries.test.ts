import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from '../db'
import {
  closeOpenEntries,
  createTimeEntry,
  latestTimeEntry,
  orphanedTimeEntry,
  runningTimeEntry,
  startTimer,
  stopTimer,
  updateTimeEntry
} from './time-entries'
import { aClient, aProject, id } from './test-support'

let db: Database
beforeEach(() => {
  db = openMemoryDatabase()
})

const refusedAs = (code: string) => expect.objectContaining({ code })

const T0 = '2026-09-04T16:10:00.000Z'
const T1 = '2026-09-04T18:00:00.000Z'
const T2 = '2026-09-05T08:00:00.000Z'

describe('one running timer', () => {
  it('starts a row with no end and reads it back as the running entry', () => {
    const project = aProject(db, aClient(db), 'active')
    const entry = startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    expect(entry.endedAt).toBeNull()
    expect(entry.startedAt).toBe(T0)
    expect(entry.source).toBe('timer')
    expect(runningTimeEntry(db)?.id).toBe(entry.id)
  })

  it('refuses a second clock while one runs', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    expect(() =>
      startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T1)
    ).toThrow(refusedAs('invalid_state'))
  })

  it('refuses reopening a closed entry while another runs', () => {
    const project = aProject(db, aClient(db), 'active')
    const closed = createTimeEntry(db, {
      id: id(), projectId: project.id, checklistItemId: null, note: '', startedAt: T0, endedAt: T1, source: 'manual'
    })
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T1)
    expect(() => updateTimeEntry(db, closed.id, { endedAt: null })).toThrow(refusedAs('invalid_state'))
  })

  it('stops the running entry at the given instant', () => {
    const project = aProject(db, aClient(db), 'active')
    const started = startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    const stopped = stopTimer(db, T1)
    expect(stopped.id).toBe(started.id)
    expect(stopped.endedAt).toBe(T1)
    expect(runningTimeEntry(db)).toBeNull()
  })

  it('refuses to stop when nothing runs', () => {
    expect(() => stopTimer(db, T1)).toThrow(refusedAs('invalid_state'))
  })

  it('can start again once stopped', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    stopTimer(db, T1)
    const again = startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T2)
    expect(runningTimeEntry(db)?.id).toBe(again.id)
  })
})

describe('orphan detection', () => {
  it('finds a clock that was running before this launch', () => {
    const project = aProject(db, aClient(db), 'active')
    const entry = startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    expect(orphanedTimeEntry(db, T2)?.id).toBe(entry.id)
  })

  it('ignores a clock started by this launch', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T2)
    expect(orphanedTimeEntry(db, T1)).toBeNull()
  })

  it('ignores a closed entry', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    stopTimer(db, T1)
    expect(orphanedTimeEntry(db, T2)).toBeNull()
  })

  it('ignores a soft-deleted open entry', () => {
    const project = aProject(db, aClient(db), 'active')
    const entry = startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    db.prepare('UPDATE time_entries SET deleted_at = ? WHERE id = ?').run(T1, entry.id)
    expect(orphanedTimeEntry(db, T2)).toBeNull()
  })
})

describe('closing on quit', () => {
  it('ends every open entry at the instant given and returns them', () => {
    const project = aProject(db, aClient(db), 'active')
    const entry = startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    const closed = closeOpenEntries(db, T1)
    expect(closed.map((row) => row.id)).toEqual([entry.id])
    expect(closed[0].endedAt).toBe(T1)
    expect(runningTimeEntry(db)).toBeNull()
  })

  it('is a no-op with nothing open', () => {
    expect(closeOpenEntries(db, T1)).toEqual([])
  })
})

describe('latestTimeEntry', () => {
  it('is the most recently started live entry, running or not', () => {
    const client = aClient(db)
    const a = aProject(db, client, 'active')
    const b = aProject(db, client, 'active', { name: 'Site build' })
    createTimeEntry(db, { id: id(), projectId: a.id, checklistItemId: null, note: '', startedAt: T0, endedAt: T1, source: 'manual' })
    createTimeEntry(db, { id: id(), projectId: b.id, checklistItemId: null, note: '', startedAt: T1, endedAt: T2, source: 'manual' })
    expect(latestTimeEntry(db)?.projectId).toBe(b.id)
  })

  it('is null on an empty log', () => {
    expect(latestTimeEntry(db)).toBeNull()
  })
})
