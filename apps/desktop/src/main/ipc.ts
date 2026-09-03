import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { currentBackground } from './window'

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

  /*
   * The theme is chosen in the renderer and stored there, but two things only
   * this process can set have to follow it: nativeTheme, which is what tints
   * macOS traffic lights and native menus, and the window's own fill, which
   * shows between a resize and the renderer repainting.
   *
   * themeSource is given the preference verbatim — it already understands
   * 'system' — and shouldUseDarkColors is read back after, so the background
   * follows the OS too when that is what was asked for.
   */
  ipcMain.on('window:set-theme', (event, theme: 'dark' | 'light' | 'system') => {
    if (theme !== 'dark' && theme !== 'light' && theme !== 'system') return
    nativeTheme.themeSource = theme
    windowFor(event)?.setBackgroundColor(currentBackground())
  })

  /* A system theme change while the preference is 'system' repaints the fill
     without the renderer having to notice. */
  nativeTheme.on('updated', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.setBackgroundColor(currentBackground())
    }
  })
}
