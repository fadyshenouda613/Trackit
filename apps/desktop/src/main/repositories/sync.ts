import type { Database } from 'better-sqlite3'
import type { PendingCounts, PendingKind } from '@trackit/shared/schemas'

/** Which tables feed which bucket on the sync popover. */
const BUCKETS: Record<PendingKind, string[]> = {
  time: ['time_entries'],
  projects: ['projects'],
  invoices: ['invoices', 'invoice_lines'],
  payments: ['payments'],
  settings: ['settings']
}

const countPending = (db: Database, table: string): number => {
  const live = table === 'settings' ? '' : ' AND deleted_at IS NULL'
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE sync_state = 'pending'${live}`).get() as { count: number }
  return row.count
}

/** Rows this machine has changed and not uploaded, per bucket; empty buckets are left out. */
export function pendingCounts(db: Database): PendingCounts {
  const counts: PendingCounts = {}
  for (const [kind, tables] of Object.entries(BUCKETS) as [PendingKind, string[]][]) {
    const total = tables.reduce((sum, table) => sum + countPending(db, table), 0)
    if (total > 0) counts[kind] = total
  }
  return counts
}
