import type {
  PendingKind,
  SyncEventKind,
  SyncFailure,
  SyncStatus,
  SyncStatusState
} from '@trackit/shared'
import type { Tone } from './tone'

/**
 * What the sidebar footer knows, and what the popover behind it says.
 *
 * The footer used to hold three states and three fixed strings — 'All changes
 * saved / 14:02', 'Syncing 3 changes / now', 'Offline — 8 pending / 2h ago'.
 * Two things were wrong with that. The times were literals, so the app claimed
 * to have last synced at 14:02 no matter when you opened it. And `offline` was
 * doing two jobs: it meant both "there is work waiting to go up", which is
 * ordinary and needs no attention, and "the last attempt did not work", which
 * does. Someone who has been on a train all morning and someone whose account
 * was signed out elsewhere are in very different situations, and the footer
 * told them both the same thing.
 *
 * So four states, and the failure carries a reason. The reason is a closed set
 * rather than a message handed up from a transport, because every one of them
 * has to be a sentence a person can act on — see failureReasons.
 *
 * The shapes are the shared schemas' (syncStatusSchema and its parts); this
 * file adds the words, and the fixtures the dev panel forces.
 */

/**
 * saved    nothing is waiting, and the last attempt worked
 * syncing  an attempt is in flight
 * pending  work is queued and the last attempt worked — ordinary, not a fault
 * failed   an attempt did not work, and the reason says what to do about it
 */
export type SyncState = SyncStatusState

export type { PendingKind, SyncEventKind, SyncFailure }

/** One line of the log, with its instant as runtime time. See time-data.ts. */
export type SyncEvent = {
  id: string
  kind: SyncEventKind
  /** Epoch ms. */
  at: number
  detail: string
}

/**
 * The status as the footer reads it: the same facts as SyncStatus, with the
 * instants as epoch ms because that is what the relative-time helpers take.
 */
export type SyncSnapshot = Omit<SyncStatus, 'lastSyncedAt' | 'log' | 'revision'> & {
  lastSyncedAt: number | null
  log: SyncEvent[]
}

/** The engine's status as the footer reads it. */
export const toSnapshot = (status: SyncStatus): SyncSnapshot => ({
  state: status.state,
  lastSyncedAt: status.lastSyncedAt === null ? null : Date.parse(status.lastSyncedAt),
  pending: status.pending,
  ...(status.failure ? { failure: status.failure } : {}),
  log: status.log.map((event) => ({ ...event, at: Date.parse(event.at) }))
})

/**
 * saved is the only positive state. pending is warm rather than red because
 * nothing is wrong with work waiting to go up. failed is the app's first use
 * of negative in the sidebar, and it earns it: it is the one state that needs
 * the person to do something.
 */
export const syncTones: Record<SyncState, Tone> = {
  saved: 'positive',
  syncing: 'accent',
  pending: 'warning',
  failed: 'negative'
}

/**
 * Each reason is a fact, then what follows from it. None of them names a
 * status code, a host or a retry count: the only useful question when a sync
 * fails is whether the work is safe, and every answer here says so first.
 */
export const failureReasons: Record<SyncFailure, { line: string; hint: string }> = {
  offline: {
    line: 'No connection',
    hint: 'Everything is safe on this machine and goes up on its own when you reconnect.'
  },
  signedOut: {
    line: 'Signed out on this machine',
    hint: 'Your work is kept on this machine under your account. Sign in again from Settings to see it and upload it.'
  },
  server: {
    line: 'Trackit did not answer',
    hint: 'Nothing was lost. It will keep trying in the background.'
  },
  tooOld: {
    line: 'This version is too old to sync',
    hint: 'Update Trackit to carry on. Your work stays on this machine until you do.'
  },
  otherAccount: {
    line: 'This data belongs to another account',
    hint: 'It was first synced under a different sign-in. Sign in as that account to sync it; nothing here is lost.'
  }
}

/** Singular and plural, so a count of one never reads as "1 invoices". */
export const pendingLabels: Record<PendingKind, [one: string, many: string]> = {
  time: ['time entry', 'time entries'],
  projects: ['project', 'projects'],
  clients: ['client', 'clients'],
  invoices: ['invoice', 'invoices'],
  payments: ['payment', 'payments'],
  settings: ['settings change', 'settings changes']
}

/** Fixed order, so the breakdown never reshuffles between states. */
const pendingOrder: PendingKind[] = ['time', 'projects', 'clients', 'invoices', 'payments', 'settings']

export const pendingTotal = (pending: SyncSnapshot['pending']): number =>
  pendingOrder.reduce((sum, kind) => sum + (pending[kind] ?? 0), 0)

/** The breakdown the popover lists, skipping anything with nothing waiting. */
export function pendingLines(
  pending: SyncSnapshot['pending']
): { kind: PendingKind; count: number; label: string }[] {
  return pendingOrder
    .filter((kind) => (pending[kind] ?? 0) > 0)
    .map((kind) => {
      const count = pending[kind] as number
      const [one, many] = pendingLabels[kind]
      return { kind, count, label: count === 1 ? one : many }
    })
}

/**
 * The sidebar sentence. Counted from the snapshot rather than typed, so the
 * footer and the popover's breakdown can never disagree about how much is
 * waiting.
 */
export function footerLabel(snapshot: SyncSnapshot): string {
  const waiting = pendingTotal(snapshot.pending)

  if (snapshot.state === 'saved') return 'All changes saved'
  if (snapshot.state === 'syncing') {
    return waiting === 0 ? 'Syncing' : `Syncing ${waiting} ${waiting === 1 ? 'change' : 'changes'}`
  }
  if (snapshot.state === 'pending') return `${waiting} waiting to upload`
  return 'Could not sync'
}

/* ---- Fixtures -------------------------------------------------------------
 * One snapshot per state, so the dev panel can force all four whatever the
 * engine is doing. The times are offsets from whenever the app is opened
 * rather than absolute instants, for the reason the header gives: a literal
 * would go stale.
 */

const MINUTE = 60_000

const event = (id: string, kind: SyncEventKind, minutesAgo: number, detail: string): SyncEvent => ({
  id,
  kind,
  at: Date.now() - minutesAgo * MINUTE,
  detail
})

/**
 * Two of these are resolved conflicts, which is the only lasting record that a
 * conflict happened at all — the notices themselves get dismissed and gone.
 */
const recentLog = (): SyncEvent[] => [
  event('e1', 'synced', 3, '6 changes uploaded'),
  event('e2', 'conflict', 41, 'Brand refresh — edited on two devices; the other version was kept'),
  event('e3', 'synced', 44, '2 changes uploaded'),
  event('e4', 'conflict', 96, 'Logo — moved on two devices; the other position was kept'),
  event('e5', 'synced', 98, '11 changes uploaded')
]

export const snapshots: Record<SyncState, SyncSnapshot> = {
  saved: {
    state: 'saved',
    lastSyncedAt: Date.now() - 3 * MINUTE,
    pending: {},
    log: recentLog()
  },
  /*
   * The same eight changes the two states either side of it are carrying.
   * Sync now walks pending -> syncing -> saved, and a count that fell from
   * eight to three on the way through would read as five changes going
   * missing rather than as eight going up.
   */
  syncing: {
    state: 'syncing',
    lastSyncedAt: Date.now() - 3 * MINUTE,
    pending: { time: 4, projects: 1, invoices: 2, payments: 1 },
    log: recentLog()
  },
  pending: {
    state: 'pending',
    lastSyncedAt: Date.now() - 134 * MINUTE,
    pending: { time: 4, projects: 1, invoices: 2, payments: 1 },
    log: recentLog()
  },
  failed: {
    state: 'failed',
    lastSyncedAt: Date.now() - 187 * MINUTE,
    pending: { time: 5, projects: 2, invoices: 1 },
    failure: 'server',
    log: [event('f1', 'failed', 2, 'Upload did not go through'), ...recentLog()]
  }
}

/**
 * What the panel's Sync lever chooses: the engine's own status, or one of the
 * four fixtures in its place.
 */
export type SyncLever = 'live' | SyncState
