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
    /**
     * The chosen preference, not the resolved theme: the main process hands it
     * straight to nativeTheme, which is what keeps macOS traffic lights and
     * native menus in step, and which already knows what "system" means.
     */
    setTheme: (theme: 'dark' | 'light' | 'system') => void
  }
}
