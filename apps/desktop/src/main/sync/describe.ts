import type { Database } from 'better-sqlite3'
import type { SyncTableName } from '@trackit/shared/schemas'

/*
 * How a row is named to a person when a conflict notice has to point at it:
 * the client's name, the project's name, the invoice's number. Read from the
 * losing local version, which is the one the person last saw.
 */

type Fields = Record<string, unknown>

const text = (row: Fields, key: string): string => (typeof row[key] === 'string' ? (row[key] as string) : '')

function nameOf(db: Database, table: 'projects' | 'invoices', id: unknown): string | null {
  if (typeof id !== 'string') return null
  const column = table === 'projects' ? 'name' : 'number'
  const row = db.prepare(`SELECT ${column} AS value FROM ${table} WHERE id = ?`).get(id) as { value: string } | undefined
  return row ? row.value : null
}

/** The first line of a note, cut short. */
const firstLine = (body: string): string => {
  const line = body.split('\n')[0]?.trim() ?? ''
  return line.length > 48 ? `${line.slice(0, 47)}…` : line
}

export function describeRow(db: Database, table: SyncTableName, row: Fields): string {
  switch (table) {
    case 'clients':
    case 'projects':
    case 'milestones':
      return text(row, 'name')
    case 'checklist_items':
    case 'invoice_lines':
      return text(row, 'label')
    case 'notes':
      return firstLine(text(row, 'body')) || 'A note'
    case 'invoices':
      return `Invoice ${text(row, 'number')}`
    case 'time_entries': {
      const project = nameOf(db, 'projects', row['projectId'])
      return project ? `Time on ${project}` : 'A time entry'
    }
    case 'payments': {
      const invoice = nameOf(db, 'invoices', row['invoiceId'])
      return invoice ? `Payment on invoice ${invoice}` : 'A payment'
    }
    case 'settings':
      return 'Settings'
  }
}
