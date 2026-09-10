import { defineConfig } from 'vitest/config'

/*
 * The two-device sync scenarios: `npm run test:sync` from the repository
 * root. They need the test Postgres the server's integration tests use
 * (apps/server/docker-compose.yml, or DATABASE_URL), because the server in
 * the middle is the real one.
 *
 * One file at a time: they share one database and truncate it between
 * tests.
 */
export default defineConfig({
  test: {
    include: ['tests/sync/**/*.integration.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
})
