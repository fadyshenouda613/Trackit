import type {
  ChecklistItem,
  Client,
  ClientListFilters,
  CreateClientInput,
  CreateNoteInput,
  CreatePaymentInput,
  CreateProjectInput,
  CreateTimeEntryInput,
  Id,
  Invoice,
  InvoiceLine,
  InvoiceListFilters,
  NewChecklistItemInput,
  NewInvoiceInput,
  NewInvoiceLineInput,
  Note,
  NoteListFilters,
  Payment,
  PendingCounts,
  Project,
  ProjectListFilters,
  ProjectTransition,
  Settings,
  StartTimerInput,
  TimeEntry,
  TimeEntryListFilters,
  UpdateChecklistItemInput,
  UpdateClientInput,
  UpdateInvoiceInput,
  UpdateInvoiceLineInput,
  UpdateNoteInput,
  UpdateProjectInput,
  UpdateSettingsInput,
  UpdateTimeEntryInput,
  VoidInvoiceInput
} from './schemas'

/*
 * Why a call did not do what it was asked. A closed set rather than a message
 * alone, so the renderer can decide what to show without reading prose:
 *
 *   validation          the input failed its schema
 *   not_found           no live row has that id
 *   invalid_transition  the status graph has no such edge
 *   not_billable        a project not yet delivered was put on an invoice
 *   already_billed      a project already on a live invoice was put on another
 *   invalid_state       the row is not in a state that allows the operation
 *   internal            something the store did not expect
 *   detached            there is no bridge — the renderer is running in a browser
 */
export type ApiErrorCode =
  | 'validation'
  | 'not_found'
  | 'invalid_transition'
  | 'not_billable'
  | 'already_billed'
  | 'invalid_state'
  | 'internal'
  | 'detached'

export type ApiError = { code: ApiErrorCode; message: string }

/**
 * Every data call answers with one of these. Nothing throws across the
 * bridge: an error is a value the renderer reads, not an exception it has to
 * catch.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError }

/**
 * The data half of the bridge: one named method per operation a screen
 * performs, each validated against the shared schema on the far side. Ids are
 * minted by the caller and travel inside the create inputs.
 */
export type DataApi = {
  clients: {
    create: (input: CreateClientInput) => Promise<Result<Client>>
    update: (id: Id, patch: UpdateClientInput) => Promise<Result<Client>>
    delete: (id: Id) => Promise<Result<Client>>
    get: (id: Id) => Promise<Result<Client | null>>
    list: (filters?: ClientListFilters) => Promise<Result<Client[]>>
  }
  projects: {
    create: (input: CreateProjectInput) => Promise<Result<Project>>
    update: (id: Id, patch: UpdateProjectInput) => Promise<Result<Project>>
    delete: (id: Id) => Promise<Result<Project>>
    get: (id: Id) => Promise<Result<Project | null>>
    list: (filters?: ProjectListFilters) => Promise<Result<Project[]>>
    /** The one step forward, or the way out. See projectTransitionSchema. */
    transition: (id: Id, to: ProjectTransition) => Promise<Result<Project>>
    /** Delivered projects of one client that are not yet on a live invoice. */
    billable: (clientId: Id) => Promise<Result<Project[]>>
    /** The live invoice a project is on, or null. */
    invoice: (projectId: Id) => Promise<Result<Invoice | null>>
  }
  checklist: {
    create: (input: NewChecklistItemInput) => Promise<Result<ChecklistItem>>
    update: (id: Id, patch: UpdateChecklistItemInput) => Promise<Result<ChecklistItem>>
    delete: (id: Id) => Promise<Result<ChecklistItem>>
    list: (projectId: Id) => Promise<Result<ChecklistItem[]>>
  }
  notes: {
    create: (input: CreateNoteInput) => Promise<Result<Note>>
    update: (id: Id, patch: UpdateNoteInput) => Promise<Result<Note>>
    delete: (id: Id) => Promise<Result<Note>>
    list: (filters: NoteListFilters) => Promise<Result<Note[]>>
  }
  time: {
    create: (input: CreateTimeEntryInput) => Promise<Result<TimeEntry>>
    update: (id: Id, patch: UpdateTimeEntryInput) => Promise<Result<TimeEntry>>
    delete: (id: Id) => Promise<Result<TimeEntry>>
    get: (id: Id) => Promise<Result<TimeEntry | null>>
    list: (filters?: TimeEntryListFilters) => Promise<Result<TimeEntry[]>>
    /** The entry with no end yet, which is the running timer, or null. */
    running: () => Promise<Result<TimeEntry | null>>
    /** Starts the clock on a project, now. Refused (invalid_state) while one runs. */
    start: (input: StartTimerInput) => Promise<Result<TimeEntry>>
    /** Ends the running entry now. Refused (invalid_state) when none runs. */
    stop: () => Promise<Result<TimeEntry>>
    /** A clock that was already running when this process launched, or null. */
    orphan: () => Promise<Result<TimeEntry | null>>
  }
  invoices: {
    create: (input: NewInvoiceInput) => Promise<Result<Invoice>>
    /** Drafts only: number, notes, tax rate, currency. */
    update: (id: Id, patch: UpdateInvoiceInput) => Promise<Result<Invoice>>
    /** Drafts only; anything issued is voided instead. */
    delete: (id: Id) => Promise<Result<Invoice>>
    get: (id: Id) => Promise<Result<Invoice | null>>
    list: (filters?: InvoiceListFilters) => Promise<Result<Invoice[]>>
    send: (id: Id) => Promise<Result<Invoice>>
    void: (id: Id, input: VoidInvoiceInput) => Promise<Result<Invoice>>
    lines: (invoiceId: Id) => Promise<Result<InvoiceLine[]>>
    addLine: (invoiceId: Id, line: NewInvoiceLineInput) => Promise<Result<InvoiceLine>>
    updateLine: (id: Id, patch: UpdateInvoiceLineInput) => Promise<Result<InvoiceLine>>
    deleteLine: (id: Id) => Promise<Result<InvoiceLine>>
  }
  payments: {
    create: (input: CreatePaymentInput) => Promise<Result<Payment>>
    delete: (id: Id) => Promise<Result<Payment>>
    list: (invoiceId: Id) => Promise<Result<Payment[]>>
  }
  settings: {
    get: () => Promise<Result<Settings>>
    update: (patch: UpdateSettingsInput) => Promise<Result<Settings>>
  }
  sync: {
    /** Local writes the server has not seen, per bucket. */
    pendingCounts: () => Promise<Result<PendingCounts>>
  }
}

export type TimerScenario = 'running' | 'over' | 'orphaned'

/**
 * The States panel's levers. Registered only in development (`!app.isPackaged`);
 * in a packaged build every call answers `{ ok: false, error: { code: 'not_found' } }`.
 */
export type DevApi = {
  /** Empties the database in place. */
  reset: () => Promise<Result<null>>
  /** Loads the fixtures into an empty database (resets first when asked). */
  seed: (options?: { reset?: boolean }) => Promise<Result<Record<string, number>>>
  /**
   * Stages a timer state the app cannot reach on its own: running on the
   * sample project, running on a project already over budget, or a clock
   * that has been running since yesterday afternoon and predates this launch.
   */
  timerScenario: (scenario: TimerScenario) => Promise<Result<TimeEntry>>
}

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
  data: DataApi
  timer: {
    /**
     * Fires after the tray or the shortcut starts or stops the clock, so the
     * renderer refetches. Returns an unsubscribe function.
     */
    onChanged: (listener: () => void) => () => void
  }
  dev: DevApi
}
