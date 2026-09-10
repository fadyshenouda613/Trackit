import { z } from 'zod'
import { resolveConflictInputSchema } from '@trackit/shared/schemas'
import { handle } from './data-ipc'
import type { SyncEngine } from './sync/engine'

/**
 * The sync channels. `sync:changed` goes the other way, pushed from
 * index.ts whenever the status moves, so the renderer never polls.
 */
export function registerSyncIpc(engine: SyncEngine): void {
  handle('sync:status', z.undefined(), () => engine.status())
  handle('sync:now', z.undefined(), () => engine.sync())
  handle('sync:conflicts', z.undefined(), () => engine.conflicts())
  handle('sync:resolveConflict', resolveConflictInputSchema, ({ id, resolution }) => {
    engine.resolveConflict(id, resolution)
    return null
  })
}
