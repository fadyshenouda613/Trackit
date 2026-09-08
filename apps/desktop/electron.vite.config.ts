import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { appIconsPlugin } from './tooling/icons'

/*
 * Dependencies are left as runtime require()s rather than bundled — except
 * @trackit/shared, which is a workspace package that ships TypeScript source
 * and no build, so main and preload have to bundle it the way the renderer
 * does. Anything else added to packages/ that main or preload import needs
 * listing here too.
 */
const bundleWorkspacePackages = (): ReturnType<typeof externalizeDepsPlugin> =>
  externalizeDepsPlugin({ exclude: ['@trackit/shared'] })

/*
 * The native addon.
 *
 * better-sqlite3 is a compiled module and stays a runtime require() — it is
 * in `dependencies`, so the plugin above already leaves it out of the bundle.
 * Since v12 it is built against Node-API, whose ABI is stable across Node and
 * Electron releases: the one prebuilt binary the package ships for this
 * platform serves the app under Electron, the seed, and the tests under Node,
 * and there is nothing to rebuild when Electron moves.
 *
 * What can go wrong is a platform the package has no prebuild for. That
 * fails at the first launch with a stack trace from deep inside the addon
 * loader, so it is checked here, at build start, with the fix in the message.
 */
const checkNativeAddons = (): Plugin => ({
  name: 'trackit:native-addons',
  buildStart() {
    const require = createRequire(__filename)
    try {
      const Database = require('better-sqlite3') as typeof import('better-sqlite3')
      const probe = new Database(':memory:')
      const { version } = probe.prepare('SELECT sqlite_version() AS version').get() as { version: string }
      probe.close()
      // lib/index.js is the entry; the prebuilds sit beside lib/.
      const packageDir = resolve(require.resolve('better-sqlite3'), '..', '..')
      const prebuild = resolve(packageDir, 'prebuilds', `${process.platform}-${process.arch}.node`)
      const binary = existsSync(prebuild) ? prebuild : 'a local node-gyp build'
      this.info(`better-sqlite3 loads (SQLite ${version}, Node-API, ${binary})`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      this.error(
        `better-sqlite3 cannot load on ${process.platform}-${process.arch}: ${reason}\n` +
          'There is no prebuilt binary for this platform. Build one from source with\n' +
          '  npm rebuild better-sqlite3\n' +
          '(needs a C++ toolchain and Python); the result serves Node and Electron alike.'
      )
    }
  }
})

export default defineConfig({
  main: {
    /* The icons go to build/, where electron-builder looks for them. */
    plugins: [bundleWorkspacePackages(), checkNativeAddons(), appIconsPlugin(resolve(__dirname, 'build'))]
  },
  preload: {
    plugins: [bundleWorkspacePackages()]
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()]
  }
})
