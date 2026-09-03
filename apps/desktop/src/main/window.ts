import { join } from 'node:path'
import { BrowserWindow, nativeTheme, shell } from 'electron'
import { appIcon } from './icon'

/**
 * bg.base in each theme, as the window's own fill: oklch(0.191 0.008 265) and
 * oklch(0.966 0.006 80). This is what shows in the moment between a resize and
 * the renderer repainting it, so a dark slab behind a light app is visible even
 * though the window is not shown until ready-to-show.
 */
export const WINDOW_BACKGROUND = { dark: '#121418', light: '#f6f3ef' } as const

/** What the window should be filled with right now, per nativeTheme. */
export const currentBackground = (): string =>
  nativeTheme.shouldUseDarkColors ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light

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
    // Windows and Linux take the app's own mark rather than Electron's default.
    icon: appIcon(),
    /* Follows the OS here rather than the stored preference, which lives in the
       renderer's localStorage and cannot be read from this process. An explicit
       override corrects it over IPC on the renderer's first effect, before the
       window is shown. */
    backgroundColor: currentBackground(),
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
