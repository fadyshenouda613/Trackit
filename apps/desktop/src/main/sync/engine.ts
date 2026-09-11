import type { Database } from 'better-sqlite3'
import {
  SYNC_PROTOCOL_VERSION,
  type AuthStatus,
  type ConflictResolution,
  type SyncConflict,
  type SyncFailure,
  type SyncRequest,
  type SyncResponse,
  type SyncStatus
} from '@trackit/shared/schemas'
import { AuthClientError } from '../auth/client'
import { nowIso } from '../db/clock'
import { pendingCounts } from '../repositories/sync'
import { applyChanges } from './apply'
import { SyncClientError, type SyncTransport } from './client'
import { listConflicts, listEvents, recordEvent, resolveConflict } from './conflicts'
import { accountUserId, cursor, deviceId, lastSyncedAt, setAccountUserId, setCursor, setLastSyncedAt } from './meta'
import { assignServerNumbers } from './numbers'
import { collectPending, markSynced, refKey } from './outbox'

/*
 * The sync engine: one run at a time, each a loop of round trips.
 *
 * A round trip collects what is pending (up to a page), sends it with the
 * cursor, and applies the answer in one SQLite transaction: pushed rows are
 * marked synced only where they have not moved since, the incoming rows
 * are applied, the cursor and the time are written. A crash anywhere
 * before that commit leaves every pushed row pending and the cursor where
 * it was; the next run re-pushes, the server answers with echoes, and both
 * sides converge. The cursor never passes data that was not applied.
 *
 * The loop goes on while the server has another page or the outbox had
 * more than a page. Two runs never overlap: a request during a run is a
 * promise of one more run after it.
 *
 * Before the first round trip, the drafts raised while the server was out
 * of reach take their numbers from it (see numbers.ts), so no provisional
 * number ever goes up.
 *
 * No Electron in here. The database, the transport and the account are
 * handed in, which is what lets the two-device suite drive two of these
 * against one real server.
 */

export type SyncAuth = {
  status: () => AuthStatus
  /** Throws AuthClientError: `unauthorized` when signed out or expired, `offline` when a refresh could not be made. */
  accessToken: () => Promise<string>
  /** Rotates the session with the server; swallows failure. Used once after a 401. */
  verify: () => Promise<void>
}

export type SyncEngineDeps = {
  db: Database
  transport: SyncTransport
  auth: SyncAuth
  /** Pushed on every move of the status. */
  onChanged: (status: SyncStatus) => void
  /** ISO now; the tests hand in their own. */
  now?: () => string
  /** How often the schedule runs. */
  intervalMs?: number
  /** Rows per push. */
  pageSize?: number
  log?: (message: string) => void
  /** Where the interruption tests cut the power. */
  hooks?: {
    beforeApply?: () => void
    beforeCommit?: () => void
  }
}

export type SyncEngine = {
  status: () => SyncStatus
  /** Runs a sync — after the one in flight, if there is one — and answers with the status after it. */
  sync: () => Promise<SyncStatus>
  /** The launch trigger and the interval. */
  start: () => void
  stop: () => void
  conflicts: () => SyncConflict[]
  resolveConflict: (id: string, resolution: ConflictResolution) => void
}

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_PAGE_SIZE = 500
/** How much of the log the status carries. */
const LOG_LINES = 20

class SyncFailed extends Error {
  constructor(
    readonly reason: SyncFailure,
    message: string
  ) {
    super(message)
    this.name = 'SyncFailed'
  }
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { db, transport, auth } = deps
  const now = deps.now ?? nowIso
  const pageSize = deps.pageSize ?? DEFAULT_PAGE_SIZE
  const log = deps.log ?? (() => undefined)

  let running = false
  let failure: SyncFailure | undefined
  let revision = 0
  let current: Promise<void> | null = null
  let queued: Promise<void> | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  const status = (): SyncStatus => {
    const pending = pendingCounts(db)
    const state = running
      ? 'syncing'
      : failure
        ? 'failed'
        : Object.keys(pending).length > 0
          ? 'pending'
          : 'saved'
    return {
      state,
      lastSyncedAt: lastSyncedAt(db),
      pending,
      ...(failure && !running ? { failure } : {}),
      log: listEvents(db, LOG_LINES),
      revision
    }
  }

  const emit = (): void => deps.onChanged(status())

  /** One call with a token, and one retry after a refresh when the token was refused. */
  const withToken = async <T>(call: (accessToken: string) => Promise<T>): Promise<T> => {
    const token = await auth.accessToken()
    try {
      return await call(token)
    } catch (error) {
      if (!(error instanceof SyncClientError) || error.code !== 'unauthorized') throw error
      await auth.verify()
      const fresh = await auth.accessToken()
      return call(fresh)
    }
  }

  const exchange = (request: SyncRequest): Promise<SyncResponse> =>
    withToken((token) => transport.push(token, request))

  /**
   * The apply transaction. Foreign keys are off for its duration because a
   * child can arrive a page before its parent (the parent was updated after
   * it, so its sequence is higher); within a page the parent-first order
   * still holds. The pragma cannot change inside a transaction, so it is set
   * around one, and restored whatever happens.
   */
  const applyPage = (
    response: SyncResponse,
    pushed: ReturnType<typeof collectPending>['pushed'],
    userId: string
  ): { applied: number; conflicts: number; uploaded: number } => {
    const at = now()
    db.pragma('foreign_keys = OFF')
    try {
      return db.transaction(() => {
        /* Applied before the marks, on purpose: a pushed row that lost is still
           pending when its winner arrives, which is what makes it a conflict.
           The mark's compare-and-set then finds a different updatedAt and
           leaves the winner alone. */
        const result = applyChanges(db, response.changes, { deviceId: deviceId(db), now: at })
        const skip = new Set(
          response.rejected.filter((rejection) => rejection.reason === 'missing_parent').map(refKey)
        )
        const uploaded = markSynced(db, pushed, skip)
        setCursor(db, response.cursor)
        setLastSyncedAt(db, at)
        if (accountUserId(db) === null) setAccountUserId(db, userId)
        deps.hooks?.beforeCommit?.()
        return { ...result, uploaded }
      })()
    } finally {
      db.pragma('foreign_keys = ON')
    }
  }

  const run = async (): Promise<void> => {
    running = true
    emit()
    let applied = 0
    let conflicts = 0
    let uploaded = 0
    let dropped = 0
    let numbered = 0
    try {
      const account = auth.status()
      if (account.state !== 'signedIn') throw new SyncFailed('signedOut', 'Not signed in')
      const bound = accountUserId(db)
      if (bound !== null && bound !== account.user.id) {
        throw new SyncFailed('otherAccount', 'This data was first synced under another account')
      }

      /* Drafts numbered here become edits, and go up in the loop below. */
      numbered = await assignServerNumbers(db, withToken, transport, now)

      for (;;) {
        const outbox = collectPending(db, pageSize)
        const request: SyncRequest = {
          protocolVersion: SYNC_PROTOCOL_VERSION,
          deviceId: deviceId(db),
          since: cursor(db),
          changes: outbox.changes
        }
        const response = await exchange(request)
        deps.hooks?.beforeApply?.()
        const page = applyPage(response, outbox.pushed, account.user.id)
        applied += page.applied
        conflicts += page.conflicts
        uploaded += page.uploaded
        dropped += response.rejected.filter((rejection) => rejection.reason === 'forbidden').length
        if (!response.hasMore && !outbox.more) break
      }

      failure = undefined
      if (dropped > 0) {
        recordEvent(db, 'failed', `${plural(dropped, 'change')} could not be kept by the server`, now())
      }
      const detail = summary(uploaded - dropped, applied)
      if (detail) recordEvent(db, 'synced', detail, now())
    } catch (error) {
      failure = reasonOf(error)
      const message = error instanceof Error ? error.message : String(error)
      log(`sync failed (${failure}): ${message}`)
      /* Being signed out is a standing condition the footer already states,
         not an event: logging it on every tick would bury the log. */
      if (failure !== 'signedOut') recordEvent(db, 'failed', failureLines[failure], now())
    } finally {
      running = false
      /* A swapped number is a local change the renderer has to hear about,
         even though nothing came down: the draft it is showing is now called
         something else. */
      if (applied > 0 || conflicts > 0 || numbered > 0) revision += 1
      emit()
    }
  }

  const sync = (): Promise<SyncStatus> => {
    if (!current) {
      current = run().finally(() => {
        current = null
      })
      return current.then(status)
    }
    if (!queued) {
      queued = current.then(() => {
        queued = null
        return sync().then(() => undefined)
      })
    }
    return queued.then(status)
  }

  return {
    status,
    sync,
    start: () => {
      if (timer) return
      timer = setInterval(() => void sync(), deps.intervalMs ?? DEFAULT_INTERVAL_MS)
      void sync()
    },
    stop: () => {
      if (timer) clearInterval(timer)
      timer = null
    },
    conflicts: () => listConflicts(db),
    resolveConflict: (id, resolution) => {
      resolveConflict(db, id, resolution, now())
      revision += 1
      emit()
    }
  }
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

/** The log line for a run that moved something; nothing for one that did not. */
function summary(uploaded: number, applied: number): string | null {
  if (uploaded > 0 && applied > 0) return `${plural(uploaded, 'change')} uploaded, ${applied} received`
  if (uploaded > 0) return `${plural(uploaded, 'change')} uploaded`
  if (applied > 0) return `${plural(applied, 'change')} received`
  return null
}

/** What a failure means to the person, from what it was to the code. */
function reasonOf(error: unknown): SyncFailure {
  if (error instanceof SyncFailed) return error.reason
  if (error instanceof SyncClientError || error instanceof AuthClientError) {
    if (error.code === 'offline') return 'offline'
    if (error.code === 'unauthorized') return 'signedOut'
    if (error.code === 'upgrade_required') return 'tooOld'
  }
  return 'server'
}

const failureLines: Record<SyncFailure, string> = {
  offline: 'No connection',
  signedOut: 'Signed out on this machine',
  server: 'Upload did not go through',
  tooOld: 'This version is too old to sync',
  otherAccount: 'This data belongs to another account'
}
