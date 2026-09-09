/*
 * `npm run db:migrate -w @trackit/server`: applies the migrations to
 * DATABASE_URL and exits. The server does the same at start; this is for a
 * deploy step or a fresh development database.
 */
import { loadConfigFromEnvFile } from '../config'
import { connect, migrate } from './index'

const config = loadConfigFromEnvFile()
const handle = connect(config.databaseUrl)
try {
  await migrate(handle.db)
  console.log('[db] migrations applied')
} finally {
  await handle.close()
}
