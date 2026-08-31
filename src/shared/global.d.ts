import type { LedgerApi } from './api'

declare global {
  interface Window {
    ledger?: LedgerApi
  }
}

export {}
