import { describe, expect, it } from 'vitest'
import type { SyncStatus } from '@trackit/shared'
import { describeFields, recordConflictBody, sampleRecordConflict } from './ConflictNotice'
import { footerLabel, pendingLines, toSnapshot } from './sync-data'

const status: SyncStatus = {
  state: 'failed',
  lastSyncedAt: '2026-09-10T09:00:00.000Z',
  pending: { clients: 1, time: 3 },
  failure: 'offline',
  log: [{ id: '00000000-0000-4000-8000-000000000001', kind: 'failed', at: '2026-09-10T09:05:00.000Z', detail: 'No connection' }],
  revision: 4
}

describe('toSnapshot', () => {
  it('turns the engine’s instants into runtime time and keeps the rest', () => {
    const snapshot = toSnapshot(status)
    expect(snapshot.lastSyncedAt).toBe(Date.parse('2026-09-10T09:00:00.000Z'))
    expect(snapshot.log[0]?.at).toBe(Date.parse('2026-09-10T09:05:00.000Z'))
    expect(snapshot).toMatchObject({ state: 'failed', failure: 'offline', pending: { clients: 1, time: 3 } })
    expect(snapshot).not.toHaveProperty('revision')
  })

  it('leaves the failure out when there is none, and a never-synced machine at null', () => {
    const saved = toSnapshot({ ...status, state: 'saved', failure: undefined, lastSyncedAt: null })
    expect(saved).not.toHaveProperty('failure')
    expect(saved.lastSyncedAt).toBeNull()
  })
})

describe('the footer sentence', () => {
  it('counts what is waiting, in the popover’s order', () => {
    const snapshot = toSnapshot({ ...status, state: 'pending' })
    expect(footerLabel(snapshot)).toBe('4 waiting to upload')
    expect(pendingLines(snapshot.pending).map((line) => line.label)).toEqual(['time entries', 'client'])
  })

  it('does not claim a number while syncing with nothing queued', () => {
    expect(footerLabel(toSnapshot({ ...status, state: 'syncing', pending: {} }))).toBe('Syncing')
  })
})

describe('what a conflict notice says', () => {
  it('names the fields in a person’s words', () => {
    expect(describeFields(['priceCents'])).toBe('the price')
    expect(describeFields(['dueAt', 'priceCents'])).toBe('the due date and the price')
    expect(describeFields(['name', 'dueAt', 'priceCents', 'status'])).toBe('the name, the due date and 2 more')
    expect(describeFields(['budgetedHours'])).toBe('the budgeted hours')
  })

  it('reads each side’s deletion', () => {
    expect(recordConflictBody(sampleRecordConflict)).toBe(
      'The due date and the price of Brand refresh changed here and on another device while this machine was offline. The other device’s version was kept.'
    )
    expect(recordConflictBody({ ...sampleRecordConflict, remoteDeletedAt: '2026-09-10T09:00:00.000Z' })).toContain('deleted on another device')
    expect(recordConflictBody({ ...sampleRecordConflict, localDeletedAt: '2026-09-10T09:00:00.000Z' })).toContain('You deleted Brand refresh here')
  })
})
