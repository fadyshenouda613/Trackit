import { defineConfig } from 'vitest/config'

/*
 * The integration tests, which need a Postgres: `npm run test:integration`
 * from this directory or `-w @trackit/server` from the root, with
 * docker-compose.yml up. The root `npm test` leaves them out on purpose.
 *
 * One file at a time, because they share one database and each truncates
 * it between tests.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'node',
    fileParallelism: false,
    /* argon2 and a cold pool make the first request slow on CI. */
    testTimeout: 20_000,
    hookTimeout: 60_000
  }
})
