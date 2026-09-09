import { defineConfig } from 'vitest/config'

/*
 * One Vitest for the whole workspace, run from the root: `npm test`.
 *
 * Tests sit beside the code they cover as `*.test.ts`. Everything under test
 * is plain TypeScript with no Electron and no DOM — the shared package's
 * schemas and helpers, and the main process's plain functions once they
 * exist — so the environment is node and there is nothing to mock.
 *
 * The server's `*.integration.test.ts` need a Postgres and are left out;
 * apps/server/vitest.config.ts runs them (`npm run test:integration -w
 * @trackit/server`, with its docker-compose.yml up).
 */
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/out/**', '**/dist/**', '**/*.integration.test.ts'],
    environment: 'node'
  }
})
