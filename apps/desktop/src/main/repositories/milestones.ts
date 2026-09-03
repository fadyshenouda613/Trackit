import type { Database } from 'better-sqlite3'
import {
  milestoneSchema,
  type CreateMilestoneInput,
  type Milestone,
  type UpdateMilestoneInput
} from '@trackit/shared/schemas'
import { createRow, defineTable, getRow, selectRows, softDeleteRow, updateRow } from './table'

/*
 * No screen renders a milestone yet; the table and these functions exist so
 * an invoice line can point at one without a later migration.
 */

export const milestonesTable = defineTable<Milestone>({
  name: 'milestones',
  label: 'milestone',
  schema: milestoneSchema
})

export const createMilestone = (db: Database, input: CreateMilestoneInput): Milestone =>
  createRow(db, milestonesTable, input)

export const updateMilestone = (db: Database, id: string, patch: UpdateMilestoneInput): Milestone =>
  updateRow(db, milestonesTable, id, patch)

export const deleteMilestone = (db: Database, id: string): Milestone =>
  softDeleteRow(db, milestonesTable, id)

export const getMilestone = (db: Database, id: string): Milestone | null =>
  getRow(db, milestonesTable, id)

export const listMilestones = (db: Database, projectId: string): Milestone[] =>
  selectRows(
    milestonesTable,
    db.prepare(
      `SELECT * FROM milestones
       WHERE project_id = @projectId AND deleted_at IS NULL
       ORDER BY sort_order, id`
    ),
    { projectId }
  )
