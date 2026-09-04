import type { Database } from 'better-sqlite3'

/*
 * Empties a development database in place. The seed's `--reset` unlinks the
 * file, which an open connection cannot do, so the States panel's "Empty"
 * choice takes this route instead: every row goes, the schema stays, and the
 * settings row goes back to what migration 001 inserted.
 *
 * Dev only. This is the one place in the app that issues DELETE, and it is
 * a wipe of the whole store, never of a record.
 */
const TABLES_IN_FK_ORDER = [
  'payments',
  'invoice_lines',
  'invoices',
  'time_entries',
  'checklist_items',
  'milestones',
  'notes',
  'projects',
  'clients'
]

export function wipeDatabase(db: Database): void {
  db.transaction(() => {
    for (const table of TABLES_IN_FK_ORDER) db.prepare(`DELETE FROM ${table}`).run()
    db.prepare('DELETE FROM settings').run()
    db.prepare("INSERT INTO settings (id, updated_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))").run()
  })()
}
