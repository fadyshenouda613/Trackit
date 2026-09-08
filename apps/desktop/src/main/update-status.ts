import type { UpdateStatus } from '@trackit/shared/schemas'

/*
 * The update state machine, as a plain function: what electron-updater
 * reports, folded into the one status the renderer reads. Kept apart from
 * updates.ts so the transitions are testable without electron-updater, which
 * cannot be constructed outside a packaged app.
 */

export type UpdateEvent =
  | { type: 'checking' }
  /* `installable` is whether the updater can swap this build in place. It
     cannot on macOS without a signature, so there the offer is `url`. */
  | { type: 'available'; version: string; installable: boolean; url: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

/**
 * A downloaded update is the most a check can achieve, so once `ready` the
 * status stays put: the periodic re-check that follows replays checking and
 * available for the same version, and a failed later check is no reason to
 * take a working offer away. The same holds for `available` on macOS.
 */
const settled = (status: UpdateStatus): boolean => status.state === 'ready' || status.state === 'available'

export function nextUpdateStatus(current: UpdateStatus, event: UpdateEvent): UpdateStatus {
  if (current.state === 'disabled') return current

  switch (event.type) {
    case 'checking':
      return settled(current) ? current : { state: 'checking' }
    case 'available':
      if (settled(current)) return current
      return event.installable
        ? { state: 'downloading', version: event.version, percent: 0 }
        : { state: 'available', version: event.version, url: event.url }
    case 'not-available':
      return { state: 'idle' }
    case 'progress':
      if (current.state !== 'downloading') return current
      return { ...current, percent: Math.min(100, Math.max(0, event.percent)) }
    case 'downloaded':
      return { state: 'ready', version: event.version }
    case 'error':
      return settled(current) ? current : { state: 'error', message: event.message }
  }
}
