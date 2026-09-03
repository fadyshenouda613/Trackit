import { beforeEach, describe, expect, it } from 'vitest'
import { openMemoryDatabase, type Database } from '../db'
import { createChecklistItem, listChecklistItems, updateChecklistItem } from './checklist-items'
import { transitionProject } from './projects'
import { aClient, aProject, id } from './test-support'

let db: Database

beforeEach(() => {
  db = openMemoryDatabase()
})

const item = (projectId: string, label: string, sortOrder: number) => ({
  id: id(),
  projectId,
  label,
  done: false,
  sortOrder
})

describe('the added-after-kickoff rule', () => {
  it('marks nothing on a draft: that is the brief', () => {
    const project = aProject(db, aClient(db), 'draft')
    const created = createChecklistItem(db, item(project.id, 'Kickoff call and brief sign-off', 1))
    expect(created.addedAfterKickoff).toBe(false)
  })

  it('marks everything created once the project is active', () => {
    const project = aProject(db, aClient(db), 'draft')
    createChecklistItem(db, item(project.id, 'Primary logo lockup', 1))
    transitionProject(db, project.id, 'active')

    const later = createChecklistItem(db, item(project.id, 'Secondary marks for social', 2))
    expect(later.addedAfterKickoff).toBe(true)

    expect(listChecklistItems(db, project.id).map((entry) => entry.addedAfterKickoff)).toEqual([false, true])
  })

  it('marks items created after delivery too', () => {
    const project = aProject(db, aClient(db), 'delivered')
    expect(createChecklistItem(db, item(project.id, 'Handover call', 1)).addedAfterKickoff).toBe(true)
  })

  it('cannot be rewritten afterwards', () => {
    const project = aProject(db, aClient(db), 'active')
    const created = createChecklistItem(db, item(project.id, 'Email signature template', 1))
    expect(() => updateChecklistItem(db, created.id, { addedAfterKickoff: false })).toThrow(
      expect.objectContaining({ code: 'invalid_state' })
    )
    const renamed = updateChecklistItem(db, created.id, { label: 'Email signature', done: true })
    expect(renamed.addedAfterKickoff).toBe(true)
    expect(renamed.done).toBe(true)
  })
})
