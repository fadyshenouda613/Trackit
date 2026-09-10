import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

/*
 * One file for the container: src/index.ts and everything it imports from
 * @trackit/shared, which ships TypeScript source and no build of its own.
 * Every real dependency stays a runtime import — argon2 is a native addon
 * and the rest have no reason to be inlined — so `external` is the
 * dependency list minus the workspace package.
 */
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const external = Object.keys(pkg.dependencies).filter((name) => name !== '@trackit/shared')

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external,
  logLevel: 'info'
})
