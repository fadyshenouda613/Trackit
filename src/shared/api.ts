/** The contract the preload bridge exposes to the renderer. */
export type LedgerApi = {
  platform: NodeJS.Platform
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    /** Returns an unsubscribe function. */
    onMaximizedChanged: (listener: (maximized: boolean) => void) => () => void
  }
}
