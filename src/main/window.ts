import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'

/**
 * Design system, "Window chrome": the app is frameless on every platform.
 *
 * On macOS the traffic lights stay, inset into the app's own chrome — the
 * artboard's 72px left padding on the recording indicator is exactly that gap.
 * On Windows/Linux there are no system controls, so the renderer draws its own
 * (see TitleBarControls) and the inset drops to the normal 16px gutter.
 */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 640,
    show: false,
    frame: false,
    // oklch(0.191 0.008 265) — bg.base, so the first paint matches the app
    backgroundColor: '#121418',
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 14 } }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.on('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}
