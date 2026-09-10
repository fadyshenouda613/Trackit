import { describe, expect, it } from 'vitest'
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_TABLE_ORDER,
  conflictResolutionSchema,
  pendingKindSchema,
  syncConflictSchema,
  syncPullRowSchemas,
  syncPushRowSchemas,
  syncRequestSchema,
  syncResponseSchema,
  syncStatusSchema,
  syncTableNameSchema
} from './index'

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const at = '2026-09-10T09:15:00.000Z'

const client = {
  id: id(1),
  name: 'Studio Nord',
  company: '',
  email: '',
  phone: '',
  address: '',
  currency: 'EUR',
  paymentTermsDays: 14,
  notes: '',
  createdAt: at,
  updatedAt: at,
  deletedAt: null,
  syncState: 'pending'
}

describe('sync table names', () => {
  it('lists every syncable table, parents before children', () => {
    expect(SYNC_TABLE_ORDER).toEqual([
      'clients',
      'projects',
      'milestones',
      'checklist_items',
      'notes',
      'invoices',
      'invoice_lines',
      'time_entries',
      'payments',
      'settings'
    ])
    for (const name of SYNC_TABLE_ORDER) expect(syncTableNameSchema.parse(name)).toBe(name)
  })
})

describe('push rows', () => {
  it('is the entity without its sync state', () => {
    const row = syncPushRowSchemas.clients.parse(client)
    expect(row).not.toHaveProperty('syncState')
    expect(row.id).toBe(id(1))
  })

  it('keeps the entity invariants', () => {
    const entry = {
      id: id(2),
      projectId: id(3),
      checklistItemId: null,
      note: '',
      startedAt: '2026-09-10T10:00:00.000Z',
      endedAt: '2026-09-10T09:00:00.000Z',
      source: 'manual',
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    }
    expect(syncPushRowSchemas.time_entries.safeParse(entry).success).toBe(false)
    expect(
      syncPushRowSchemas.notes.safeParse({
        id: id(4),
        projectId: null,
        clientId: null,
        body: 'x',
        pinned: false,
        createdAt: at,
        updatedAt: at,
        deletedAt: null
      }).success
    ).toBe(false)
  })

  it('sends settings without the machine-local fields and without an id', () => {
    const settings = {
      person: 'Alex',
      businessName: '',
      address: '',
      email: '',
      phone: '',
      logo: null,
      currency: 'USD',
      taxRate: 0,
      paymentTermsDays: 14,
      numberingScheme: 'INV-0000',
      rateFloorCents: 0,
      shortcut: 'CommandOrControl+Shift+S',
      updatedAt: at
    }
    expect(syncPushRowSchemas.settings.parse(settings)).toEqual(settings)
    /* Stripped rather than refused: the client parses its own row through this. */
    const stripped = syncPushRowSchemas.settings.parse({ ...settings, theme: 'dark', accountEmail: 'a@b.co', syncState: 'pending' })
    expect(stripped).toEqual(settings)
  })
})

describe('pull rows', () => {
  it('carry the device that wrote them, which may be unknown', () => {
    const { syncState: _, ...pushed } = client
    expect(syncPullRowSchemas.clients.parse({ ...pushed, updatedBy: id(9) }).updatedBy).toBe(id(9))
    expect(syncPullRowSchemas.clients.parse({ ...pushed, updatedBy: null }).updatedBy).toBeNull()
    expect(syncPullRowSchemas.clients.safeParse(pushed).success).toBe(false)
  })
})

describe('request and response', () => {
  it('accepts only the current protocol version', () => {
    const request = { protocolVersion: SYNC_PROTOCOL_VERSION, deviceId: id(9), since: 0, changes: {} }
    expect(syncRequestSchema.parse(request)).toEqual(request)
    expect(syncRequestSchema.safeParse({ ...request, protocolVersion: 2 }).success).toBe(false)
    expect(syncRequestSchema.safeParse({ ...request, since: -1 }).success).toBe(false)
  })

  it('validates each table of changes with its own row schema', () => {
    const { syncState: _, ...pushed } = client
    const request = {
      protocolVersion: 1,
      deviceId: id(9),
      since: 12,
      changes: { clients: [pushed] }
    }
    expect(syncRequestSchema.parse(request).changes.clients).toEqual([pushed])
    expect(
      syncRequestSchema.safeParse({ ...request, changes: { clients: [{ ...pushed, currency: 'XXX' }] } }).success
    ).toBe(false)
    expect(syncRequestSchema.safeParse({ ...request, changes: { widgets: [] } }).success).toBe(false)
  })

  it('round-trips a response', () => {
    const { syncState: _, ...pushed } = client
    const response = {
      cursor: 40,
      hasMore: true,
      changes: { clients: [{ ...pushed, updatedBy: id(9) }] },
      rejected: [{ table: 'projects', id: id(5), reason: 'missing_parent' }]
    }
    expect(syncResponseSchema.parse(response)).toEqual(response)
  })
})

describe('status and conflicts', () => {
  it('counts clients as a pending kind', () => {
    expect(pendingKindSchema.parse('clients')).toBe('clients')
  })

  it('parses a status with a failure and a log', () => {
    const status = {
      state: 'failed',
      lastSyncedAt: at,
      pending: { clients: 1, time: 2 },
      failure: 'offline',
      log: [{ id: id(7), kind: 'failed', at, detail: 'No connection' }],
      revision: 3
    }
    expect(syncStatusSchema.parse(status)).toEqual(status)
    expect(syncStatusSchema.safeParse({ ...status, failure: 'meteor' }).success).toBe(false)
  })

  it('parses a conflict and the two resolutions', () => {
    const conflict = {
      id: id(8),
      table: 'projects',
      rowId: id(3),
      kind: 'record',
      projectId: id(3),
      label: 'Brand refresh',
      fields: ['priceCents', 'dueAt'],
      localDeletedAt: null,
      remoteDeletedAt: null,
      detectedAt: at
    }
    expect(syncConflictSchema.parse(conflict)).toEqual(conflict)
    expect(conflictResolutionSchema.parse('keepTheirs')).toBe('keepTheirs')
    expect(conflictResolutionSchema.parse('restoreMine')).toBe('restoreMine')
  })
})
