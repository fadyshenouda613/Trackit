import { app, globalShortcut, Menu, nativeImage, Tray, type NativeImage } from 'electron'
import { formatElapsed } from '@trackit/shared/helpers'

/** What the tray needs to know about the timer, and nothing else. */
export type TrayTimerState =
  | { running: false; lastProject: string }
  | { running: true; project: string; client: string; elapsedSeconds: number }

type TrayDeps = {
  getState: () => TrayTimerState
  /** Stop when running, start the last project when not. */
  onToggle: () => void
  onOpen: () => void
}

const SHORTCUT = 'CommandOrControl+Shift+S'

/*
 * The tray glyph is the app's own recording dot: filled while a timer runs,
 * hollow while it does not, so the menu bar answers the question without being
 * opened. Drawn into a bitmap rather than shipped as a file — it is two circles,
 * and a build asset for two circles is a build asset to keep in sync.
 *
 * macOS gets a black template image and tints it itself; everywhere else the
 * icon has to supply its own colour against a dark system bar.
 */
function dotIcon(filled: boolean): NativeImage {
  const scale = 2
  const size = 16 * scale
  const buffer = Buffer.alloc(size * size * 4)
  const centre = (size - 1) / 2
  const outer = 5.5 * scale
  const inner = 3.5 * scale
  const template = process.platform === 'darwin'
  const level = template ? 0 : 255

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - centre, y - centre)
      let alpha = Math.min(1, Math.max(0, outer - distance + 0.5))
      if (!filled) alpha = Math.min(alpha, Math.min(1, Math.max(0, distance - inner + 0.5)))

      const offset = (y * size + x) * 4
      const premultiplied = Math.round(level * alpha)
      buffer[offset] = premultiplied // B
      buffer[offset + 1] = premultiplied // G
      buffer[offset + 2] = premultiplied // R
      buffer[offset + 3] = Math.round(alpha * 255)
    }
  }

  const image = nativeImage.createFromBitmap(buffer, { width: size, height: size, scaleFactor: scale })
  if (template) image.setTemplateImage(true)
  return image
}

const running = dotIcon(true)
const idle = dotIcon(false)

/**
 * "Current project, elapsed time, Stop, and the shortcut."
 *
 * The first two lines are disabled items rather than a tooltip: a tooltip is a
 * hover away, and the reason to open this menu is usually to read them. The
 * shortcut is the item's real accelerator, so it renders in the platform's own
 * idiom, and it is registered for real — a hint that does not work is worse
 * than no hint. registerAccelerator is off so the menu displays it without
 * binding it a second time.
 */
export function createTray(deps: TrayDeps): { refresh: () => void; destroy: () => void } {
  const tray = new Tray(idle)

  const build = (): void => {
    const state = deps.getState()

    const header: Electron.MenuItemConstructorOptions[] = state.running
      ? [
          { label: `${state.project} — ${state.client}`, enabled: false },
          { label: formatElapsed(state.elapsedSeconds), enabled: false }
        ]
      : [{ label: 'No timer running', enabled: false }]

    const toggleItem: Electron.MenuItemConstructorOptions[] =
      !state.running && state.lastProject === ''
        ? []
        : [
            {
              label: state.running ? 'Stop timer' : `Start ${state.lastProject}`,
              accelerator: SHORTCUT,
              registerAccelerator: false,
              click: deps.onToggle
            }
          ]

    tray.setContextMenu(
      Menu.buildFromTemplate([
        ...header,
        { type: 'separator' },
        ...toggleItem,
        { type: 'separator' },
        { label: 'Open Trackit', click: deps.onOpen },
        { label: 'Quit Trackit', click: () => app.quit() }
      ])
    )

    tray.setImage(state.running ? running : idle)
    tray.setToolTip(
      state.running
        ? `Trackit — ${state.project}, ${formatElapsed(state.elapsedSeconds)}`
        : 'Trackit — no timer running'
    )

    // Only macOS has room for a running clock beside the icon.
    if (process.platform === 'darwin') {
      tray.setTitle(state.running ? formatElapsed(state.elapsedSeconds) : '')
    }
  }

  // Windows and Linux do not open the context menu on a left click.
  if (process.platform !== 'darwin') tray.on('click', () => tray.popUpContextMenu())

  if (!globalShortcut.register(SHORTCUT, deps.onToggle)) {
    console.warn(`Trackit: ${SHORTCUT} is already taken; the tray hint will not fire.`)
  }

  build()

  return {
    refresh: build,
    destroy: () => {
      globalShortcut.unregister(SHORTCUT)
      tray.destroy()
    }
  }
}
