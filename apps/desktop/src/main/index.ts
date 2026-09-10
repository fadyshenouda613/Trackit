import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, safeStorage } from 'electron'
import { registerAuthIpc } from './auth-ipc'
import { createAuthClient } from './auth/client'
import { createAuthService } from './auth/service'
import { createSessionStore } from './auth/session-store'
import { registerDataIpc } from './data-ipc'
import { openDatabase } from './db'
import { nowIso } from './db/clock'
import { registerWindowIpc } from './ipc'
import { closeOpenEntries, getSettings, runningTimeEntry } from './repositories'
import { createSyncClient } from './sync/client'
import { createSyncEngine } from './sync/engine'
import { registerSyncIpc } from './sync-ipc'
import { toggleTimer, trayState } from './timer'
import { createTray, type TrayHandle } from './tray'
import { createUpdater, registerUpdateIpc } from './updates'
import { createMainWindow } from './window'

/**
 * The database lives beside the rest of this app's per-user state. `userData`
 * follows the app's name, so the seed — which runs as this same entry with
 * `--seed` — lands on the same file by construction.
 */
function databasePath(): string {
  const directory = app.getPath('userData')
  mkdirSync(directory, { recursive: true })
  return join(directory, 'trackit.db')
}

/**
 * Where the account server is. An environment variable wins, so a
 * development build can be pointed anywhere; a packaged build carries the
 * URL electron-vite inlined from MAIN_VITE_SERVER_URL at build time; and
 * with neither, the server's own development default.
 */
function serverUrl(): string {
  return process.env.TRACKIT_SERVER_URL ?? import.meta.env.MAIN_VITE_SERVER_URL ?? 'http://127.0.0.1:4000'
}

app.whenReady().then(async () => {
  /*
   * `electron . --seed` loads the fixture data and exits; no window, no tray.
   * The seed is a separate chunk, pulled in only on this path.
   */
  if (process.argv.includes('--seed')) {
    const { runSeed } = await import('./seed')
    const code = await runSeed({
      file: databasePath(),
      reset: process.argv.includes('--reset'),
      log: (message) => console.log(`[seed] ${message}`)
    })
    app.exit(code)
    return
  }

  const db = openDatabase(databasePath(), { log: (message) => console.log(`[db] ${message}`) })

  const bootedAt = nowIso()

  /* The tray is created below, after the window; the closures registered here
     run only once a channel is called, by which time it exists. Declared up
     front rather than closed over in its own dead zone. */
  let tray: TrayHandle | null = null

  /* Everything that changes the clock ends here: the tray redraws and every
     window is told to refetch. */
  const broadcastTimer = (): void => {
    tray?.refresh()
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('timer:changed')
  }

  /* The one setting main acts on for itself. The renderer stores it; this is
     what makes it true of the running app. */
  let shortcut = getSettings(db).shortcut

  registerWindowIpc()
  registerDataIpc(db, {
    bootedAt,
    onTimerChanged: () => broadcastTimer(),
    onSettingsChanged: (settings) => {
      if (settings.shortcut === shortcut) return
      shortcut = settings.shortcut
      tray?.rebind(shortcut)
    }
  })
  if (!app.isPackaged) {
    const { registerDevIpc } = await import('./dev-ipc')
    registerDevIpc(db, { onTimerChanged: () => broadcastTimer() })
  }

  /* Every move of the update status is pushed to the renderer, which shows
     the notice when there is something to restart into. */
  const updater = createUpdater({
    packaged: app.isPackaged,
    platform: process.platform,
    onChanged: (status) => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('updates:changed', status)
    }
  })
  registerUpdateIpc(updater)

  /*
   * The account. The session file sits beside the database; its token is
   * encrypted with whatever the OS offers. Every move of the status is
   * pushed to the renderer the way the update status is, and a stored
   * session is confirmed with the server in the background once the window
   * is up — a failure to reach it changes nothing.
   */
  const auth = createAuthService({
    store: createSessionStore(
      join(app.getPath('userData'), 'session.json'),
      {
        available: () => safeStorage.isEncryptionAvailable(),
        encrypt: (plain) => safeStorage.encryptString(plain),
        decrypt: (blob) => safeStorage.decryptString(blob)
      },
      (message) => console.warn(`[auth] ${message}`)
    ),
    client: createAuthClient({ baseUrl: serverUrl() }),
    onChanged: (status) => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('auth:changed', status)
    }
  })
  registerAuthIpc(auth)

  /*
   * The sync engine. Every move of its status is pushed the way the others
   * are. It starts once the window is up and the session has been
   * confirmed — a launch trigger, then the interval; the renderer asks for
   * the rest (Sync now, the network coming back).
   */
  const sync = createSyncEngine({
    db,
    transport: createSyncClient({ baseUrl: serverUrl() }),
    auth,
    onChanged: (status) => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sync:changed', status)
    },
    log: (message) => console.warn(`[sync] ${message}`)
  })
  registerSyncIpc(sync)

  const window = createMainWindow()
  void auth.verify().then(() => sync.start())

  // Keep the renderer's maximize affordance in sync with the real window state.
  const emitMaximized = (): void => window.webContents.send('window:maximized-changed', window.isMaximized())
  window.on('maximize', emitMaximized)
  window.on('unmaximize', emitMaximized)

  tray = createTray({
    getState: () => trayState(db, Date.now()),
    shortcut,
    onToggle: () => {
      /* A refused write — two clocks at once, a project that has gone — is a
         value everywhere else in this app, and the tray has nobody to hand it
         to. It is logged and the broadcast still happens, so the menu redraws
         from what the database actually holds rather than from the move it
         was asked to make. */
      try {
        toggleTimer(db)
      } catch (error) {
        console.error(`[tray] ${error instanceof Error ? error.message : String(error)}`)
      }
      broadcastTimer()
    },
    onOpen: () => {
      const existing = BrowserWindow.getAllWindows()[0] ?? createMainWindow()
      if (existing.isMinimized()) existing.restore()
      existing.show()
      existing.focus()
    }
  })

  /*
   * Once a second while a clock runs, so the elapsed line in the menu is
   * live. Nothing is counted here — refresh reads the row and the clock.
   */
  const tick = setInterval(() => {
    if (runningTimeEntry(db)) tray?.refresh()
  }, 1000)

  app.on('before-quit', () => {
    clearInterval(tick)
    sync.stop()
    updater.destroy()
    /* A clean quit never leaves a clock running; anything found running at
       the next launch therefore survived a crash and is offered for recovery. */
    closeOpenEntries(db)
    tray?.destroy()
    db.close()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
