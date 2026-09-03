import type { Database } from 'better-sqlite3'
import {
  noteSchema,
  type CreateNoteInput,
  type Note,
  type NoteListFilters,
  type UpdateNoteInput
} from '@trackit/shared/schemas'
import { createRow, defineTable, selectRows, softDeleteRow, updateRow } from './table'

export const notesTable = defineTable<Note>({
  name: 'notes',
  label: 'note',
  schema: noteSchema,
  booleans: ['pinned']
})

export const createNote = (db: Database, input: CreateNoteInput): Note =>
  createRow(db, notesTable, input)

/** Re-validated as a whole after merging, so a note cannot end up owned by both or neither. */
export const updateNote = (db: Database, id: string, patch: UpdateNoteInput): Note =>
  updateRow(db, notesTable, id, patch)

export const deleteNote = (db: Database, id: string): Note => softDeleteRow(db, notesTable, id)

/** One owner's notes, pinned first, then newest first — the order both panels print. */
export function listNotes(db: Database, filters: NoteListFilters): Note[] {
  const owner =
    filters.projectId !== undefined
      ? { column: 'project_id', id: filters.projectId }
      : { column: 'client_id', id: filters.clientId }
  return selectRows(
    notesTable,
    db.prepare(
      `SELECT * FROM notes
       WHERE ${owner.column} = @id AND deleted_at IS NULL
       ORDER BY pinned DESC, created_at DESC, id`
    ),
    { id: owner.id }
  )
}
