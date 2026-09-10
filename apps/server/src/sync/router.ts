import express, { Router } from 'express'
import { SYNC_PROTOCOL_VERSION, syncRequestEnvelopeSchema } from '@trackit/shared/schemas'
import { requireAuth, type AuthLocals } from '../auth/middleware'
import type { AuthDeps } from '../auth/service'
import { AppError } from '../errors'
import { runSync } from './service'

/*
 * POST /sync. One handler, the same three lines as every other route: parse
 * the body with the shared schema, call the plain function, send what it
 * returned. The body parser is this route's own because a sync carries a
 * settings logo, which is a data URL, and can run to megabytes where the
 * rest of the API takes a form.
 */

export type SyncRouterOptions = {
  deps: AuthDeps
  /** Rows per page; see runSync. */
  pageSize: number
  /** Bytes. */
  bodyLimit: string
}

export function syncRouter(options: SyncRouterOptions): Router {
  const router = Router()

  /* The token is checked before the body is read: nobody unsigned gets to
     hand this route eight megabytes. */
  router.post('/', requireAuth(options.deps), express.json({ limit: options.bodyLimit }), async (req, res) => {
    /*
     * Checked before the schema, which only knows the current version: a
     * client on another one is told to upgrade, not that its body is wrong.
     */
    const version = (req.body as { protocolVersion?: unknown } | undefined)?.protocolVersion
    if (typeof version === 'number' && version !== SYNC_PROTOCOL_VERSION) {
      throw new AppError(
        426,
        'upgrade_required',
        `This server speaks sync protocol ${SYNC_PROTOCOL_VERSION}; this client speaks ${version}`
      )
    }

    const { auth } = res.locals as AuthLocals
    const request = syncRequestEnvelopeSchema.parse(req.body)
    const response = await runSync(options.deps.db, auth.userId, request, { pageSize: options.pageSize })
    res.json(response)
  })

  return router
}
