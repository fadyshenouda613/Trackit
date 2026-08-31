import { BrowserWindow, ipcMain } from 'electron'

/**
 * Window controls for the platforms that have no system chrome of their own.
 * The renderer owns the buttons; the main process owns the window.
 */
export function registerWindowIpc(): void {
  const windowFor = (event: Electron.IpcMainEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(event.sender)

  ipcMain.on('window:minimize', (event) => windowFor(event)?.minimize())

  ipcMain.on('window:toggle-maximize', (event) => {
    const window = windowFor(event)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  ipcMain.on('window:close', (event) => windowFor(event)?.close())

  ipcMain.handle('window:is-maximized', (event) =>
    BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  )
}
