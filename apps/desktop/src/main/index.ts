import { app, BrowserWindow } from 'electron'
import { registerWindowIpc } from './ipc'
import { createTray, type TrayTimerState } from './tray'
import { createMainWindow } from './window'

const CLIENT = 'Northwind Studio'

/*
 * There is no store behind the timer yet, so the tray runs off a stub that
 * starts where the renderer's own default does — Brand refresh, 01:24:36 in.
 * It ticks for real: the elapsed line is the only thing in that menu worth
 * rebuilding once a second, and a frozen clock would read as a bug.
 */
let timer: TrayTimerState = {
  running: true,
  project: 'Brand refresh',
  client: CLIENT,
  elapsedSeconds: 5076
}

app.whenReady().then(() => {
  registerWindowIpc()

  const window = createMainWindow()

  // Keep the renderer's maximize affordance in sync with the real window state.
  const emitMaximized = (): void => window.webContents.send('window:maximized-changed', window.isMaximized())
  window.on('maximize', emitMaximized)
  window.on('unmaximize', emitMaximized)

  const tray = createTray({
    getState: () => timer,
    onToggle: () => {
      timer = timer.running
        ? { running: false, lastProject: timer.project }
        : { running: true, project: timer.lastProject, client: CLIENT, elapsedSeconds: 0 }
      tray.refresh()
    },
    onOpen: () => {
      const existing = BrowserWindow.getAllWindows()[0] ?? createMainWindow()
      if (existing.isMinimized()) existing.restore()
      existing.show()
      existing.focus()
    }
  })

  const tick = setInterval(() => {
    if (!timer.running) return
    timer = { ...timer, elapsedSeconds: timer.elapsedSeconds + 1 }
    tray.refresh()
  }, 1000)

  app.on('before-quit', () => {
    clearInterval(tick)
    tray.destroy()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
