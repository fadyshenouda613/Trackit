import type { Database } from 'better-sqlite3'
import {
  checklistItemSchema,
  type ChecklistItem,
  type NewChecklistItemInput,
  type UpdateChecklistItemInput
} from '@trackit/shared/schemas'
import { RepositoryError } from './errors'
import { projectsTable } from './projects'
import { createRow, defineTable, requireRow, selectRows, softDeleteRow, updateRow } from './table'

export const checklistItemsTable = defineTable<ChecklistItem>({
  name: 'checklist_items',
  label: 'checklist item',
  schema: checklistItemSchema,
  booleans: ['done', 'addedAfterKickoff']
})

/**
 * The rule the checklist exists for: an item created while its project is
 * active or anywhere past it was added after kickoff, and says so for good.
 * Only an item on a draft is part of the brief.
 */
export function createChecklistItem(db: Database, input: NewChecklistItemInput): ChecklistItem {
  const project = requireRow(db, projectsTable, input.projectId)
  return createRow(db, checklistItemsTable, {
    ...input,
    addedAfterKickoff: project.status !== 'draft'
  })
}

/** Label, done and position. The flag is history and cannot be rewritten. */
export function updateChecklistItem(
  db: Database,
  id: string,
  patch: UpdateChecklistItemInput
): ChecklistItem {
  if (patch.addedAfterKickoff !== undefined) {
    throw new RepositoryError('invalid_state', 'addedAfterKickoff is set when an item is created and never changes')
  }
  return updateRow(db, checklistItemsTable, id, patch)
}

export const deleteChecklistItem = (db: Database, id: string): ChecklistItem =>
  softDeleteRow(db, checklistItemsTable, id)

/** A project's live items in list order. */
export const listChecklistItems = (db: Database, projectId: string): ChecklistItem[] =>
  selectRows(
    checklistItemsTable,
    db.prepare(
      `SELECT * FROM checklist_items
       WHERE project_id = @projectId AND deleted_at IS NULL
       ORDER BY sort_order, id`
    ),
    { projectId }
  )
