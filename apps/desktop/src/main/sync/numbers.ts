import type { Database } from 'better-sqlite3'
import type { AuthStatus } from '@trackit/shared/schemas'
import {
  assignInvoiceNumber,
  listProvisionalInvoices,
  nextNumber,
  type InvoiceNumbering
} from '../repositories/invoices'
import { getSettings } from '../repositories/settings'
import type { SyncTransport } from './client'
import { recordEvent } from './conflicts'

/*
 * Invoice numbers, and where they come from.
 *
 * The server issues them: it counts across every machine and hands each
 * value out once. This machine asks at two moments. When a draft is raised,
 * so that a draft made with the server in reach carries its final number
 * from the start; and at the start of every sync, for the drafts raised
 * while it was not — those hold the local scheme's guess, flagged
 * provisional, and take the server's word before the row goes up. Either
 * way the scheme sent is this machine's setting; the counter is the
 * server's.
 */

export type NumberingDeps = {
  transport: SyncTransport
  /** Throws when signed out, expired, or the refresh could not be made. */
  accessToken: () => Promise<string>
  status: () => AuthStatus
}

/**
 * What a new draft is numbered with. The server's number when it can be
 * reached; the local guess, flagged, when it cannot — for any reason at all.
 * Raising a draft never fails because the server did.
 */
export async function numberForNewInvoice(db: Database, deps: NumberingDeps, invoiceId: string): Promise<InvoiceNumbering> {
  const account = deps.status()
  if (account.state === 'signedIn' && account.session === 'active') {
    try {
      const token = await deps.accessToken()
      const minted = await deps.transport.mintNumber(token, invoiceId, getSettings(db).numberingScheme)
      return { number: minted.number, numberProvisional: false }
    } catch {
      /* Offline, a timeout, a 5xx — the draft still has to exist. */
    }
  }
  return { number: nextNumber(db), numberProvisional: true }
}

/**
 * The swap. Every live provisional draft asks the server for its number,
 * takes it as an ordinary edit, and says so in the log. Throws the first
 * transport failure it meets, which the engine reports as the run's; the
 * drafts already numbered keep their numbers.
 */
export async function assignServerNumbers(
  db: Database,
  request: (call: (accessToken: string) => Promise<{ number: string }>) => Promise<{ number: string }>,
  transport: SyncTransport,
  now: () => string,
  /** Called after each draft is numbered, so a caller knows what landed even when a later mint throws. */
  onNumbered: () => void = () => undefined
): Promise<number> {
  const drafts = listProvisionalInvoices(db)
  if (drafts.length === 0) return 0
  const scheme = getSettings(db).numberingScheme
  for (const draft of drafts) {
    const minted = await request((token) => transport.mintNumber(token, draft.id, scheme))
    assignInvoiceNumber(db, draft.id, minted.number)
    onNumbered()
    recordEvent(
      db,
      'synced',
      minted.number === draft.number
        ? `Draft ${draft.number} kept its number`
        : `Draft ${draft.number} is now ${minted.number}`,
      now()
    )
  }
  return drafts.length
}
