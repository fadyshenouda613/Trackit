import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/*
 * Dependencies are left as runtime require()s rather than bundled — except
 * @trackit/shared, which is a workspace package that ships TypeScript source
 * and no build, so main and preload have to bundle it the way the renderer
 * does. Anything else added to packages/ that main or preload import needs
 * listing here too.
 */
const bundleWorkspacePackages = (): ReturnType<typeof externalizeDepsPlugin> =>
  externalizeDepsPlugin({ exclude: ['@trackit/shared'] })

export default defineConfig({
  main: {
    plugins: [bundleWorkspacePackages()]
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
