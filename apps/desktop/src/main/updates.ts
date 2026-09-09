import { shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { z } from 'zod'
import type { UpdateStatus } from '@trackit/shared/schemas'
import { handle } from './data-ipc'
import { nextUpdateStatus, type UpdateEvent } from './update-status'

/*
 * electron-updater against this repository's GitHub Releases, which is where
 * release.yml puts every build. The feed's coordinates come from
 * resources/app-update.yml, written by electron-builder from the `publish`
 * block in electron-builder.yml; the page linked below has to agree with it.
 *
 * Windows: the NSIS build is downloaded in the background and installed on
 * the next quit — or now, when the notice's Restart is pressed. Unsigned is
 * fine here; electron-updater only verifies a signature the running build
 * already carries.
 *
 * macOS: Squirrel.Mac refuses to swap in an app it cannot verify, and these
 * builds are not signed. The check still runs — it is one HTTPS request for
 * latest-mac.yml — but nothing is downloaded; the notice offers the release
 * page instead. That changes the moment the builds are signed: flip
 * `installable` below and the rest is already wired.
 */

const RELEASES = 'https://github.com/fadyshenouda613/New-folder--2-/releases'
const releasePage = (version: string): string => `${RELEASES}/tag/v${version}`

/** Once shortly after launch, then a few times a day. */
const FIRST_CHECK_MS = 10_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

export type UpdaterDeps = {
  /** `app.isPackaged`: a development build has no feed to check and says so. */
  packaged: boolean
  platform: NodeJS.Platform
  onChanged: (status: UpdateStatus) => void
}

export type UpdaterHandle = {
  status: () => UpdateStatus
  /** Asks the feed now. Resolves with the status once the check has answered. */
  check: () => Promise<UpdateStatus>
  /**
   * Acts on the current offer: restarts into a downloaded build, or opens
   * the release page for one that cannot be installed in place. Otherwise
   * does nothing, so a stale button is harmless.
   */
  install: () => void
  destroy: () => void
}

export function createUpdater(deps: UpdaterDeps): UpdaterHandle {
  let status: UpdateStatus = deps.packaged
    ? { state: 'idle' }
    : { state: 'disabled', reason: 'Updates are only checked in a packaged build' }

  const apply = (event: UpdateEvent): void => {
    const next = nextUpdateStatus(status, event)
    if (next === status) return
    status = next
    deps.onChanged(status)
  }

  if (!deps.packaged) {
    return {
      status: () => status,
      check: () => Promise.resolve(status),
      install: () => undefined,
      destroy: () => undefined
    }
  }

  const installable = deps.platform !== 'darwin'

  autoUpdater.autoDownload = installable
  autoUpdater.autoInstallOnAppQuit = installable
  autoUpdater.logger = {
    info: (message: unknown) => console.log(`[updates] ${String(message)}`),
    warn: (message: unknown) => console.warn(`[updates] ${String(message)}`),
    error: (message: unknown) => console.error(`[updates] ${String(message)}`),
    debug: () => undefined
  }

  autoUpdater.on('checking-for-update', () => apply({ type: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    apply({ type: 'available', version: info.version, installable, url: releasePage(info.version) })
  )
  autoUpdater.on('update-not-available', () => apply({ type: 'not-available' }))
  autoUpdater.on('download-progress', (progress) => apply({ type: 'progress', percent: progress.percent }))
  autoUpdater.on('update-downloaded', (info) => apply({ type: 'downloaded', version: info.version }))
  autoUpdater.on('error', (error) => apply({ type: 'error', message: error.message }))

  /* checkForUpdates rejects on a network failure as well as emitting 'error';
     the event has already moved the status, so the rejection has nothing to
     add. */
  const check = async (): Promise<UpdateStatus> => {
    await autoUpdater.checkForUpdates().catch(() => null)
    return status
  }

  const first = setTimeout(() => void check(), FIRST_CHECK_MS)
  const periodic = setInterval(() => void check(), CHECK_EVERY_MS)

  return {
    status: () => status,
    check,
    install: () => {
      if (status.state === 'ready') autoUpdater.quitAndInstall()
      else if (status.state === 'available') void shell.openExternal(status.url)
    },
    destroy: () => {
      clearTimeout(first)
      clearInterval(periodic)
      autoUpdater.removeAllListeners()
    }
  }
}

/**
 * The update channels. `updates:changed` goes the other way, pushed from
 * index.ts whenever the status moves, so the renderer never polls.
 */
export function registerUpdateIpc(updater: UpdaterHandle): void {
  handle('updates:status', z.undefined(), () => updater.status())
  handle('updates:check', z.undefined(), () => updater.check())
  handle('updates:install', z.undefined(), () => {
    updater.install()
    return null
  })
}
