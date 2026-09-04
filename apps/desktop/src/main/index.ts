import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { registerDataIpc } from './data-ipc'
import { openDatabase } from './db'
import { nowIso } from './db/clock'
import { registerWindowIpc } from './ipc'
import { closeOpenEntries, runningTimeEntry } from './repositories'
import { toggleTimer, trayState } from './timer'
import { createTray } from './tray'
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

  /* Everything that changes the clock ends here: the tray redraws and every
     window is told to refetch. */
  const broadcastTimer = (): void => {
    tray.refresh()
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('timer:changed')
  }

  registerWindowIpc()
  registerDataIpc(db, { bootedAt, onTimerChanged: () => broadcastTimer() })
  if (!app.isPackaged) {
    const { registerDevIpc } = await import('./dev-ipc')
    registerDevIpc(db, { onTimerChanged: () => broadcastTimer() })
  }

  const window = createMainWindow()

  // Keep the renderer's maximize affordance in sync with the real window state.
  const emitMaximized = (): void => window.webContents.send('window:maximized-changed', window.isMaximized())
  window.on('maximize', emitMaximized)
  window.on('unmaximize', emitMaximized)

  const tray = createTray({
    getState: () => trayState(db, Date.now()),
    onToggle: () => {
      toggleTimer(db)
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
    if (runningTimeEntry(db)) tray.refresh()
  }, 1000)

  app.on('before-quit', () => {
    clearInterval(tick)
    /* A clean quit never leaves a clock running; anything found running at
       the next launch therefore survived a crash and is offered for recovery. */
    closeOpenEntries(db)
    tray.destroy()
    db.close()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
