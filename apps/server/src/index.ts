import { createApp, type Logger } from './app'
import { ConfigError, loadConfigFromEnvFile } from './config'
import { connect, migrate } from './db'

/*
 * Start: read the configuration, bring the database up to date, listen.
 * Stop: on SIGTERM or SIGINT — which is how Railway, Render and Docker ask —
 * stop taking connections, let the ones in flight finish, close the pool.
 */

const log: Logger = {
  info: (message) => console.log(`[server] ${message}`),
  error: (message, error) => {
    /* The stack goes here and only here. */
    console.error(`[server] ${message}`, error instanceof Error ? error.stack ?? error.message : error)
  }
}

let config
try {
  config = loadConfigFromEnvFile()
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : error)
  process.exit(1)
}

const handle = connect(config.databaseUrl)
await migrate(handle.db)
log.info('database is up to date')

const app = createApp({ config, db: handle.db, log })
const server = app.listen(config.port, () => log.info(`listening on :${config.port} (${config.env})`))

let stopping = false
const stop = (signal: string): void => {
  if (stopping) return
  stopping = true
  log.info(`${signal} received, shutting down`)
  server.close(() => {
    void handle.close().then(() => process.exit(0))
  })
  /* A connection that never ends must not keep the process alive past the
     platform's grace period. */
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => stop('SIGTERM'))
process.on('SIGINT', () => stop('SIGINT'))
