import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { sql } from 'drizzle-orm'
import { authRouter } from './auth/router'
import type { AuthDeps } from './auth/service'
import type { PdfRenderer } from './invoices/pdf'
import { invoicesRouter } from './invoices/router'
import { syncRouter } from './sync/router'
import type { Config } from './config'
import type { Db } from './db'
import { errorHandler, notFoundHandler } from './errors'

export type Logger = {
  info: (message: string) => void
  error: (message: string, error?: unknown) => void
}

export type AppOptions = {
  config: Config
  db: Db
  log: Logger
  /** Prints invoices. Owned by the caller, which closes it on shutdown. */
  pdf: PdfRenderer
  /** The clock the auth service uses; the tests hand in their own. */
  now?: () => Date
}

/**
 * The whole server as one Express app, built from its dependencies and not
 * listening: index.ts listens, the tests hand it to supertest.
 */
export function createApp(options: AppOptions): Express {
  const { config, db, log } = options
  const app = express()

  /* Behind a proxy the client address is in X-Forwarded-For; the rate
     limiter keys on it, so it has to be trusted there and only there. */
  app.set('trust proxy', config.trustProxy ? 1 : false)

  app.use(helmet())
  app.use(
    cors({
      /* No Origin header — the desktop, curl, another server — is not a
         cross-origin request and is simply answered. A browser origin is
         answered with CORS headers only if it is on the list. */
      origin: (origin, callback) => callback(null, origin !== undefined && config.corsOrigins.includes(origin)),
      methods: ['GET', 'POST'],
      maxAge: 600
    })
  )
  const deps: AuthDeps = {
    db,
    jwtSecret: config.jwtSecret,
    accessTokenTtlSeconds: config.accessTokenTtlSeconds,
    refreshTokenTtlDays: config.refreshTokenTtlDays,
    now: options.now ?? (() => new Date())
  }

  /* Mounted ahead of the small body parser below, because a sync body can
     carry a logo; the route brings its own parser with its own limit, and
     the general one steps aside from a body that is already read. */
  app.use('/sync', syncRouter({ deps, pageSize: config.syncPageSize, bodyLimit: config.syncBodyLimit }))

  /* Nothing else this API takes is bigger than a sign-up form. */
  app.use(express.json({ limit: '32kb' }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.get('/health/ready', async (_req, res) => {
    await db.execute(sql`select 1`)
    res.json({ ok: true })
  })

  app.use('/auth', authRouter({ deps, rateLimit: config.authRateLimit }))
  app.use('/invoices', invoicesRouter({ deps, pdf: options.pdf }))

  app.use(notFoundHandler)
  app.use(
    errorHandler({
      exposeInternal: config.env !== 'production',
      log: (message, error) => log.error(message, error)
    })
  )

  return app
}
