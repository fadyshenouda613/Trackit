import { contextBridge, ipcRenderer } from 'electron'
import type { DataApi, LedgerApi } from '@trackit/shared/api'

/*
 * One entry per channel, each the mirror of a handler in main/data-ipc.ts.
 * Every call carries a single payload and answers with a Result; the typing
 * is the DataApi contract, so a channel without a handler is a type error on
 * the renderer's side before it is a runtime error here.
 */
const data: DataApi = {
  clients: {
    create: (input) => ipcRenderer.invoke('clients:create', input),
    update: (id, patch) => ipcRenderer.invoke('clients:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('clients:delete', id),
    get: (id) => ipcRenderer.invoke('clients:get', id),
    list: (filters) => ipcRenderer.invoke('clients:list', filters)
  },
  projects: {
    create: (input) => ipcRenderer.invoke('projects:create', input),
    update: (id, patch) => ipcRenderer.invoke('projects:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('projects:delete', id),
    get: (id) => ipcRenderer.invoke('projects:get', id),
    list: (filters) => ipcRenderer.invoke('projects:list', filters),
    transition: (id, to) => ipcRenderer.invoke('projects:transition', { id, to }),
    billable: (clientId) => ipcRenderer.invoke('projects:billable', clientId),
    invoice: (projectId) => ipcRenderer.invoke('projects:invoice', projectId)
  },
  checklist: {
    create: (input) => ipcRenderer.invoke('checklist:create', input),
    update: (id, patch) => ipcRenderer.invoke('checklist:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('checklist:delete', id),
    list: (projectId) => ipcRenderer.invoke('checklist:list', projectId)
  },
  notes: {
    create: (input) => ipcRenderer.invoke('notes:create', input),
    update: (id, patch) => ipcRenderer.invoke('notes:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('notes:delete', id),
    list: (filters) => ipcRenderer.invoke('notes:list', filters)
  },
  time: {
    create: (input) => ipcRenderer.invoke('time:create', input),
    update: (id, patch) => ipcRenderer.invoke('time:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('time:delete', id),
    get: (id) => ipcRenderer.invoke('time:get', id),
    list: (filters) => ipcRenderer.invoke('time:list', filters),
    running: () => ipcRenderer.invoke('time:running')
  },
  invoices: {
    create: (input) => ipcRenderer.invoke('invoices:create', input),
    update: (id, patch) => ipcRenderer.invoke('invoices:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('invoices:delete', id),
    get: (id) => ipcRenderer.invoke('invoices:get', id),
    list: (filters) => ipcRenderer.invoke('invoices:list', filters),
    send: (id) => ipcRenderer.invoke('invoices:send', id),
    void: (id, input) => ipcRenderer.invoke('invoices:void', { id, input }),
    lines: (invoiceId) => ipcRenderer.invoke('invoices:lines', invoiceId),
    addLine: (invoiceId, line) => ipcRenderer.invoke('invoices:addLine', { invoiceId, line }),
    updateLine: (id, patch) => ipcRenderer.invoke('invoices:updateLine', { id, patch }),
    deleteLine: (id) => ipcRenderer.invoke('invoices:deleteLine', id)
  },
  payments: {
    create: (input) => ipcRenderer.invoke('payments:create', input),
    delete: (id) => ipcRenderer.invoke('payments:delete', id),
    list: (invoiceId) => ipcRenderer.invoke('payments:list', invoiceId)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch)
  }
}

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
  },
  data
}

contextBridge.exposeInMainWorld('ledger', api)
