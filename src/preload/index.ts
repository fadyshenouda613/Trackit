import { contextBridge, ipcRenderer } from 'electron'
import type { LedgerApi } from '../shared/api'

const api: LedgerApi = {
  platform: process.platform,
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChanged: (listener) => {
      const handler = (_event: unknown, maximized: boolean): void => listener(maximized)
      ipcRenderer.on('window:maximized-changed', handler)
      return () => ipcRenderer.removeListener('window:maximized-changed', handler)
    },
    setTheme: (theme) => ipcRenderer.send('window:set-theme', theme)
  }
}

contextBridge.exposeInMainWorld('ledger', api)
