import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, safeStorage } from 'electron'
import type { AuthStatus } from '@trackit/shared/schemas'
import { registerAuthIpc } from './auth-ipc'
import { createAuthClient } from './auth/client'
import { createAuthService } from './auth/service'
import { createSessionStore } from './auth/session-store'
import { registerDataIpc } from './data-ipc'
import { openDatabase } from './db'
import { databaseFileFor, openAccountDatabase } from './db/accounts'
import { nowIso } from './db/clock'
import { createDatabaseSlot } from './db/slot'
import { registerWindowIpc } from './ipc'
import { createPdfClient } from './pdf/client'
import { createPdfService } from './pdf/service'
import { registerPdfIpc } from './pdf-ipc'
import { closeOpenEntries, getSettings, runningTimeEntry } from './repositories'
import { createSyncClient } from './sync/client'
import { createSyncEngine } from './sync/engine'
import { numberForNewInvoice } from './sync/numbers'
import { registerSyncIpc } from './sync-ipc'
import { toggleTimer, trayState } from './timer'
import { createTray, type TrayHandle } from './tray'
import { createUpdater, registerUpdateIpc } from './updates'
import { createMainWindow } from './window'

/**
 * The databases live beside the rest of this app's per-user state: the local
 * file, and one per account that has signed in here (see db/accounts.ts).
 * `userData` follows the app's name, so the seed — which runs as this same
 * entry with `--seed` — lands on the local file by construction, for the
 * first account to sign in to take over.
 */
function userDataDirectory(): string {
  const directory = app.getPath('userData')
  mkdirSync(directory, { recursive: true })
  return directory
}

/** The account a database is opened for: the local file when there is none. */
const accountOf = (status: AuthStatus): string | null => (status.state === 'signedIn' ? status.user.id : null)

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
      file: databaseFileFor(userDataDirectory(), null),
      reset: process.argv.includes('--reset'),
      log: (message) => console.log(`[seed] ${message}`)
    })
    app.exit(code)
    return
  }

  /*
   * The account comes first, because the file depends on it. The session
   * file sits beside the databases; its token is encrypted with whatever the
   * OS offers. Every move of the status is pushed to the renderer the way
   * the update status is, and a stored session is confirmed with the server
   * in the background once the window is up — a failure to reach it changes
   * nothing.
   */
  /* Declared ahead of the account service, whose status changes drive them;
     the closures run only once a status moves, by which time both exist. */
  let sync: ReturnType<typeof createSyncEngine> | null = null
  let switchAccount: (status: AuthStatus) => Promise<void> = async () => undefined

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
      /* The file follows the account. Once it has, sync at once rather than
         at the next tick of the interval: signing in is the moment the
         ledger can start moving, and signing out is what the footer should
         say straight away. */
      void switchAccount(status)
        .then(() => sync?.sync())
        .catch((error: unknown) => console.error(`[db] ${error instanceof Error ? error.message : String(error)}`))
    }
  })
  registerAuthIpc(auth)

  /*
   * The database: the one for the signed-in account, or the local file. Every
   * service below takes the slot's handle and keeps it; switching accounts
   * swaps the connection underneath.
   */
  const directory = userDataDirectory()
  const dbLog = (message: string): void => console.log(`[db] ${message}`)
  const slot = createDatabaseSlot(openAccountDatabase(directory, accountOf(auth.status()), { log: dbLog }))
  const db = slot.db

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
   * The sync engine. Every move of its status is pushed the way the others
   * are. It starts once the window is up and the session has been
   * confirmed — a launch trigger, then the interval; the renderer asks for
   * the rest (Sync now, the network coming back).
   */
  const transport = createSyncClient({ baseUrl: serverUrl() })
  sync = createSyncEngine({
    db,
    transport,
    auth,
    onChanged: (status) => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sync:changed', status)
    },
    log: (message) => console.warn(`[sync] ${message}`)
  })
  registerSyncIpc(sync)
  const engine = sync

  /*
   * Switching accounts. Waits for the run in flight so no sync straddles two
   * files, then swaps without yielding: the old file gets the same send-off
   * a quit gives it (a clock left running is closed, to be offered for
   * recovery when that account is back) and is closed before the new one is
   * opened, because opening may adopt the very file being closed, and a
   * rename of an open file is refused on Windows. Then the engine forgets a
   * failure that was the old file's and moves its revision so every screen
   * refetches, and the tray redraws from the new one.
   */
  switchAccount = async (status) => {
    const userId = accountOf(status)
    const file = databaseFileFor(directory, userId)
    if (slot.current().name === file) return
    await engine.idle()
    /* A later change may have landed while waiting; it will do its own swap. */
    if (slot.current().name === file) return

    const previous = slot.current()
    closeOpenEntries(previous)
    previous.close()
    try {
      slot.replace(openAccountDatabase(directory, userId, { log: dbLog }))
    } catch (error) {
      /* The old file is known good: back on it, and the failure is reported
         rather than left as a closed handle every channel would trip over. */
      slot.replace(openDatabase(previous.name, { log: dbLog }))
      throw error
    }
    engine.reset()
    broadcastTimer()
    const settings = getSettings(db)
    if (settings.shortcut !== shortcut) {
      shortcut = settings.shortcut
      tray?.rebind(shortcut)
    }
  }

  /*
   * The data channels come after the account and the engine because one of
   * them needs both: raising a draft asks the server for its number first,
   * through the same transport the engine uses, and falls back to a
   * provisional one when the server cannot be asked.
   */
  registerDataIpc(db, {
    bootedAt,
    onTimerChanged: () => broadcastTimer(),
    onSettingsChanged: (settings) => {
      if (settings.shortcut === shortcut) return
      shortcut = settings.shortcut
      tray?.rebind(shortcut)
    },
    numbering: (invoiceId) =>
      numberForNewInvoice(
        db,
        { transport, accessToken: () => auth.accessToken(), status: () => auth.status() },
        invoiceId
      )
  })

  /* The PDF of an invoice: rendered by the server, kept beside the database. */
  registerPdfIpc(
    createPdfService({
      db,
      transport: createPdfClient({ baseUrl: serverUrl() }),
      accessToken: () => auth.accessToken(),
      sync: () => engine.sync(),
      cacheDir: join(app.getPath('userData'), 'invoice-pdfs')
    })
  )

  const window = createMainWindow()
  void auth.verify().then(() => engine.start())

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
    engine.stop()
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
