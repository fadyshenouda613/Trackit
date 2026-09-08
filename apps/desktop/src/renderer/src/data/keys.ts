import type {
  ClientListFilters,
  Id,
  InvoiceListFilters,
  NoteListFilters,
  ProjectListFilters,
  TimeEntryListFilters
} from '@trackit/shared/schemas'

/**
 * Every query key the renderer uses, in one place, so a mutation's
 * invalidation and a query's key are never typed twice.
 */
export const keys = {
  clients: {
    all: ['clients'] as const,
    list: (filters?: ClientListFilters) => ['clients', 'list', filters ?? {}] as const,
    one: (id: Id) => ['clients', 'one', id] as const
  },
  projects: {
    all: ['projects'] as const,
    list: (filters?: ProjectListFilters) => ['projects', 'list', filters ?? {}] as const,
    one: (id: Id) => ['projects', 'one', id] as const,
    billable: (clientId: Id) => ['projects', 'billable', clientId] as const,
    invoice: (projectId: Id) => ['projects', 'invoice', projectId] as const
  },
  checklist: {
    all: ['checklist'] as const,
    list: (projectId: Id) => ['checklist', projectId] as const
  },
  notes: {
    all: ['notes'] as const,
    list: (filters: NoteListFilters) => ['notes', filters] as const
  },
  time: {
    all: ['time'] as const,
    list: (filters?: TimeEntryListFilters) => ['time', 'list', filters ?? {}] as const,
    running: ['time', 'running'] as const,
    orphan: ['time', 'orphan'] as const
  },
  invoices: {
    all: ['invoices'] as const,
    list: (filters?: InvoiceListFilters) => ['invoices', 'list', filters ?? {}] as const,
    one: (id: Id) => ['invoices', 'one', id] as const,
    lines: (id: Id) => ['invoices', 'lines', id] as const
  },
  payments: {
    all: ['payments'] as const,
    list: (invoiceId: Id) => ['payments', invoiceId] as const
  },
  settings: ['settings'] as const,
  updates: ['updates'] as const,
  sync: {
    pending: ['sync', 'pending'] as const
  }
}
