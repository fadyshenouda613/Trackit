import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { entryMinutes, totalMinutes } from '@trackit/shared/helpers'
import type { Id, Timestamp } from '@trackit/shared/schemas'
import { openDatabase, openMemoryDatabase, type Database } from '../db'
import {
  closeOpenEntries,
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntry,
  latestTimeEntry,
  listTimeEntries,
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

/* A finished entry typed in by hand, the way the Time screen's rows arrive. */
const manual = (db: Database, projectId: Id, startedAt: Timestamp, endedAt: Timestamp) =>
  createTimeEntry(db, { id: id(), projectId, checklistItemId: null, note: '', startedAt, endedAt, source: 'manual' })

describe('the order of the two ends', () => {
  it('refuses a stop before the start and leaves the clock running', () => {
    const project = aProject(db, aClient(db), 'active')
    const started = startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T1)
    expect(() => stopTimer(db, T0)).toThrow(/cannot end before it starts/)
    expect(runningTimeEntry(db)?.id).toBe(started.id)
    expect(getTimeEntry(db, started.id)?.endedAt).toBeNull()
  })

  it('allows a stop at the very instant of the start: an empty entry, not a refused one', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
    const stopped = stopTimer(db, T0)
    expect(stopped.endedAt).toBe(T0)
    expect(entryMinutes(stopped)).toBe(0)
    expect(runningTimeEntry(db)).toBeNull()
  })

  it('refuses a manual entry that ends before it starts, and writes nothing', () => {
    const project = aProject(db, aClient(db), 'active')
    expect(() => manual(db, project.id, T1, T0)).toThrow(/cannot end before it starts/)
    expect(listTimeEntries(db)).toEqual([])
  })

  it('judges an edit on the merged row: moving either end past the other is refused, and the row is untouched', () => {
    const project = aProject(db, aClient(db), 'active')
    const entry = manual(db, project.id, T0, T1)
    expect(() => updateTimeEntry(db, entry.id, { startedAt: T2 })).toThrow(/cannot end before it starts/)
    expect(() => updateTimeEntry(db, entry.id, { endedAt: '2026-09-04T16:00:00.000Z' })).toThrow(
      /cannot end before it starts/
    )
    expect(getTimeEntry(db, entry.id)).toEqual(entry)
  })
})

describe('a manual entry edited after the fact', () => {
  it('moves the duration with whichever end is retyped, keeps its source and stamps the edit', () => {
    const project = aProject(db, aClient(db), 'active')
    const entry = manual(db, project.id, '2026-09-04T09:00:00.000Z', '2026-09-04T10:00:00.000Z')
    expect(entryMinutes(entry)).toBe(60)

    const longer = updateTimeEntry(db, entry.id, { endedAt: '2026-09-04T11:30:00.000Z' })
    expect(entryMinutes(longer)).toBe(150)
    expect(longer.startedAt).toBe(entry.startedAt)
    expect(longer.source).toBe('manual')
    expect(longer.syncState).toBe('pending')
    expect(longer.updatedAt > entry.updatedAt).toBe(true)

    const later = updateTimeEntry(db, entry.id, { startedAt: '2026-09-04T10:15:00.000Z' })
    expect(entryMinutes(later)).toBe(75)
    expect(entryMinutes(getTimeEntry(db, entry.id) ?? entry)).toBe(75)
  })
})

describe('a clock that runs across midnight or a DST change', () => {
  it('stores the two UTC instants it was given, verbatim, and measures between them', () => {
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, '2026-09-04T23:30:00.000Z')
    const stopped = stopTimer(db, '2026-09-05T00:30:00.000Z')
    expect(stopped.startedAt).toBe('2026-09-04T23:30:00.000Z')
    expect(stopped.endedAt).toBe('2026-09-05T00:30:00.000Z')
    expect(entryMinutes(stopped)).toBe(60)
  })

  it('neither gains nor loses the hour a wall clock does at a DST change', () => {
    /* Europe springs forward at 01:00Z on 29 Mar 2026. */
    const project = aProject(db, aClient(db), 'active')
    startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, '2026-03-29T00:30:00.000Z')
    const stopped = stopTimer(db, '2026-03-29T02:30:00.000Z')
    expect(entryMinutes(stopped)).toBe(120)
  })
})

describe('a second clock', () => {
  it('refuses a manual entry with no end while a clock runs, but takes a finished one', () => {
    const project = aProject(db, aClient(db), 'active')
    const started = startTimer(db, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T1)
    expect(() =>
      createTimeEntry(db, {
        id: id(), projectId: project.id, checklistItemId: null, note: '', startedAt: T2, endedAt: null, source: 'manual'
      })
    ).toThrow(refusedAs('invalid_state'))
    manual(db, project.id, '2026-09-03T09:00:00.000Z', '2026-09-03T10:00:00.000Z')
    expect(listTimeEntries(db)).toHaveLength(2)
    expect(runningTimeEntry(db)?.id).toBe(started.id)
  })
})

describe('the list window', () => {
  const FROM = '2026-09-07T00:00:00.000Z'
  const TO = '2026-09-14T00:00:00.000Z'
  const ids = (entries: { id: Id }[]): Id[] => entries.map((entry) => entry.id)

  it('includes an entry started at from and excludes one started at to', () => {
    const project = aProject(db, aClient(db), 'active')
    const first = manual(db, project.id, FROM, '2026-09-07T01:00:00.000Z')
    manual(db, project.id, TO, '2026-09-14T01:00:00.000Z')
    expect(ids(listTimeEntries(db, { from: FROM, to: TO }))).toEqual([first.id])
  })

  it('files an entry by its start: one that runs into the window from before it belongs to the earlier one', () => {
    const project = aProject(db, aClient(db), 'active')
    const straddles = manual(db, project.id, '2026-09-06T23:30:00.000Z', '2026-09-07T00:30:00.000Z')
    expect(listTimeEntries(db, { from: FROM, to: TO })).toEqual([])
    expect(ids(listTimeEntries(db, { from: '2026-08-31T00:00:00.000Z', to: FROM }))).toEqual([straddles.id])
  })

  it('partitions the log between adjacent windows and between projects, so every minute is counted once', () => {
    const client = aClient(db)
    const a = aProject(db, client, 'active')
    const b = aProject(db, client, 'active', { name: 'Site build' })
    manual(db, a.id, '2026-09-06T22:00:00.000Z', '2026-09-07T01:00:00.000Z') // 180, the week before
    manual(db, a.id, '2026-09-07T00:00:00.000Z', '2026-09-07T00:45:00.000Z') // 45, this week
    manual(db, b.id, '2026-09-13T23:59:00.000Z', '2026-09-14T00:30:00.000Z') // 31, this week
    manual(db, b.id, '2026-09-14T00:00:00.000Z', '2026-09-14T02:00:00.000Z') // 120, the week after

    const previous = listTimeEntries(db, { from: '2026-08-31T00:00:00.000Z', to: FROM })
    const current = listTimeEntries(db, { from: FROM, to: TO })
    const next = listTimeEntries(db, { from: TO, to: '2026-09-21T00:00:00.000Z' })
    const whole = totalMinutes(listTimeEntries(db))
    expect(whole).toBe(376)
    expect(totalMinutes(current)).toBe(76)
    expect(totalMinutes(previous) + totalMinutes(current) + totalMinutes(next)).toBe(whole)

    const byProject =
      totalMinutes(listTimeEntries(db, { projectId: a.id })) + totalMinutes(listTimeEntries(db, { projectId: b.id }))
    expect(byProject).toBe(whole)
    expect(totalMinutes(listTimeEntries(db, { projectId: b.id, from: FROM, to: TO }))).toBe(31)
  })

  it('leaves a soft-deleted entry out of every window, total and lookup', () => {
    const project = aProject(db, aClient(db), 'active')
    const entry = manual(db, project.id, '2026-09-08T09:00:00.000Z', '2026-09-08T10:00:00.000Z')
    deleteTimeEntry(db, entry.id)
    expect(listTimeEntries(db, { from: FROM, to: TO })).toEqual([])
    expect(totalMinutes(listTimeEntries(db))).toBe(0)
    expect(latestTimeEntry(db)).toBeNull()
    expect(getTimeEntry(db, entry.id)).toBeNull()
  })

  it('is oldest first, with the id breaking a tie on the start', () => {
    const project = aProject(db, aClient(db), 'active')
    const later = manual(db, project.id, '2026-09-08T09:00:00.000Z', '2026-09-08T10:00:00.000Z')
    const earlier = manual(db, project.id, '2026-09-07T09:00:00.000Z', '2026-09-07T10:00:00.000Z')
    const tieB = '00000000-0000-4000-8000-00000000000b'
    const tieA = '00000000-0000-4000-8000-00000000000a'
    for (const tied of [tieB, tieA]) {
      createTimeEntry(db, {
        id: tied, projectId: project.id, checklistItemId: null, note: '',
        startedAt: '2026-09-09T09:00:00.000Z', endedAt: '2026-09-09T10:00:00.000Z', source: 'manual'
      })
    }
    expect(ids(listTimeEntries(db))).toEqual([earlier.id, later.id, tieA, tieB])
  })
})

describe('surviving a restart', () => {
  const withFile = (run: (file: string) => void): void => {
    const directory = mkdtempSync(join(tmpdir(), 'trackit-timer-'))
    try {
      run(join(directory, 'trackit.db'))
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }

  it('finds a running clock in the file after closing and reopening it, measured from its original start', () => {
    withFile((file) => {
      const first = openDatabase(file)
      const project = aProject(first, aClient(first), 'active')
      const started = startTimer(first, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
      first.close()

      const second = openDatabase(file)
      const running = runningTimeEntry(second)
      expect(running?.id).toBe(started.id)
      expect(running?.startedAt).toBe(T0)
      expect(orphanedTimeEntry(second, T2)?.id).toBe(started.id)
      expect(entryMinutes(stopTimer(second, T2))).toBe(15 * 60 + 50)
      second.close()
    })
  })

  it('finds nothing to recover after a clean quit closed the clock', () => {
    withFile((file) => {
      const first = openDatabase(file)
      const project = aProject(first, aClient(first), 'active')
      const started = startTimer(first, { id: id(), projectId: project.id, checklistItemId: null, note: '' }, T0)
      closeOpenEntries(first, T1)
      first.close()

      const second = openDatabase(file)
      expect(runningTimeEntry(second)).toBeNull()
      expect(orphanedTimeEntry(second, T2)).toBeNull()
      expect(getTimeEntry(second, started.id)?.endedAt).toBe(T1)
      second.close()
    })
  })
})
