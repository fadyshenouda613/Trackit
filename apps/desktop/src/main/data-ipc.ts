import { ipcMain } from 'electron'
import { z } from 'zod'
import type { ApiError, Result } from '@trackit/shared/api'
import {
  clientListFiltersSchema,
  createClientInputSchema,
  createNoteInputSchema,
  createPaymentInputSchema,
  createProjectInputSchema,
  createTimeEntryInputSchema,
  idSchema,
  invoiceListFiltersSchema,
  newChecklistItemInputSchema,
  newInvoiceInputSchema,
  newInvoiceLineInputSchema,
  noteListFiltersSchema,
  projectListFiltersSchema,
  projectTransitionSchema,
  startTimerInputSchema,
  type Settings,
  timeEntryListFiltersSchema,
  updateChecklistItemInputSchema,
  updateClientInputSchema,
  updateInvoiceInputSchema,
  updateInvoiceLineInputSchema,
  updateNoteInputSchema,
  updateProjectInputSchema,
  updateSettingsInputSchema,
  updateTimeEntryInputSchema,
  voidInvoiceInputSchema
} from '@trackit/shared/schemas'
import type { Database } from './db'
import * as repo from './repositories'

/*
 * The data channels. Each handler is the same three lines: parse the payload
 * with the shared schema, call the plain function, answer with a Result.
 * Nothing thrown here reaches the renderer as an exception.
 */

export function toApiError(error: unknown): ApiError {
  if (error instanceof repo.RepositoryError) return { code: error.code, message: error.message }
  // A merged row that fails its schema — an end before its start, say.
  if (error instanceof z.ZodError) return { code: 'validation', message: z.prettifyError(error) }
  return { code: 'internal', message: error instanceof Error ? error.message : String(error) }
}

export function handle<S extends z.ZodType, T>(
  channel: string,
  schema: S,
  /* Synchronous for every database call; a promise for the few that wait on
     something outside the process, such as the update feed. */
  run: (input: z.output<S>) => T | Promise<T>,
  /* Given what the call returned, so a hook can act on the new row rather
     than reading it back out of the database a second time. */
  after?: (data: T) => void
): void {
  ipcMain.handle(channel, async (_event, payload: unknown): Promise<Result<T>> => {
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      return { ok: false, error: { code: 'validation', message: z.prettifyError(parsed.error) } }
    }
    try {
      const data = await run(parsed.data)
      after?.(data)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: toApiError(error) }
    }
  })
}

/** `{ id, patch }`, the shape every update travels as. */
const withId = <S extends z.ZodType>(patch: S) => z.object({ id: idSchema, patch })

/** A list call may be made with no filters at all. */
const optional = <S extends z.ZodType>(filters: S) => filters.optional()

export type DataIpcDeps = {
  /** When this process came up; a clock running from before it is an orphan. */
  bootedAt: string
  /** The tray redraws and the renderer refetches after any change to the clock. */
  onTimerChanged: () => void
  /** Settings that main acts on — the global shortcut — are rebound from here. */
  onSettingsChanged: (settings: Settings) => void
}

export function registerDataIpc(db: Database, deps: DataIpcDeps): void {
  const { onTimerChanged } = deps
  handle('clients:create', createClientInputSchema, (input) => repo.createClient(db, input))
  handle('clients:update', withId(updateClientInputSchema), ({ id, patch }) => repo.updateClient(db, id, patch))
  handle('clients:delete', idSchema, (id) => repo.deleteClient(db, id))
  handle('clients:get', idSchema, (id) => repo.getClient(db, id))
  handle('clients:list', optional(clientListFiltersSchema), (filters) => repo.listClients(db, filters))

  handle('projects:create', createProjectInputSchema, (input) => repo.createProject(db, input))
  handle('projects:update', withId(updateProjectInputSchema), ({ id, patch }) => repo.updateProject(db, id, patch))
  handle('projects:delete', idSchema, (id) => repo.deleteProject(db, id))
  handle('projects:get', idSchema, (id) => repo.getProject(db, id))
  handle('projects:list', optional(projectListFiltersSchema), (filters) => repo.listProjects(db, filters))
  handle(
    'projects:transition',
    z.object({ id: idSchema, to: projectTransitionSchema }),
    ({ id, to }) => repo.transitionProject(db, id, to)
  )
  handle('projects:billable', idSchema, (clientId) => repo.listBillableProjects(db, clientId))
  handle('projects:invoice', idSchema, (projectId) => repo.invoiceForProject(db, projectId))

  handle('checklist:create', newChecklistItemInputSchema, (input) => repo.createChecklistItem(db, input))
  handle('checklist:update', withId(updateChecklistItemInputSchema), ({ id, patch }) => repo.updateChecklistItem(db, id, patch))
  handle('checklist:delete', idSchema, (id) => repo.deleteChecklistItem(db, id))
  handle('checklist:list', idSchema, (projectId) => repo.listChecklistItems(db, projectId))

  handle('notes:create', createNoteInputSchema, (input) => repo.createNote(db, input))
  handle('notes:update', withId(updateNoteInputSchema), ({ id, patch }) => repo.updateNote(db, id, patch))
  handle('notes:delete', idSchema, (id) => repo.deleteNote(db, id))
  handle('notes:list', noteListFiltersSchema, (filters) => repo.listNotes(db, filters))

  handle('time:create', createTimeEntryInputSchema, (input) => repo.createTimeEntry(db, input), onTimerChanged)
  handle('time:update', withId(updateTimeEntryInputSchema), ({ id, patch }) => repo.updateTimeEntry(db, id, patch), onTimerChanged)
  handle('time:delete', idSchema, (id) => repo.deleteTimeEntry(db, id), onTimerChanged)
  handle('time:get', idSchema, (id) => repo.getTimeEntry(db, id))
  handle('time:list', optional(timeEntryListFiltersSchema), (filters) => repo.listTimeEntries(db, filters))
  handle('time:running', z.undefined(), () => repo.runningTimeEntry(db))
  handle('time:start', startTimerInputSchema, (input) => repo.startTimer(db, input), onTimerChanged)
  handle('time:stop', z.undefined(), () => repo.stopTimer(db), onTimerChanged)
  handle('time:orphan', z.undefined(), () => repo.orphanedTimeEntry(db, deps.bootedAt))

  handle('invoices:create', newInvoiceInputSchema, (input) => repo.createInvoice(db, input))
  handle('invoices:update', withId(updateInvoiceInputSchema), ({ id, patch }) => repo.updateInvoice(db, id, patch))
  handle('invoices:delete', idSchema, (id) => repo.deleteInvoice(db, id))
  handle('invoices:get', idSchema, (id) => repo.getInvoice(db, id))
  handle('invoices:list', optional(invoiceListFiltersSchema), (filters) => repo.listInvoices(db, filters))
  handle('invoices:send', idSchema, (id) => repo.sendInvoice(db, id))
  handle(
    'invoices:void',
    z.object({ id: idSchema, input: voidInvoiceInputSchema }),
    ({ id, input }) => repo.voidInvoice(db, id, input)
  )
  handle('invoices:lines', idSchema, (invoiceId) => repo.listInvoiceLines(db, invoiceId))
  handle(
    'invoices:addLine',
    z.object({ invoiceId: idSchema, line: newInvoiceLineInputSchema }),
    ({ invoiceId, line }) => repo.addInvoiceLine(db, invoiceId, line)
  )
  handle('invoices:updateLine', withId(updateInvoiceLineInputSchema), ({ id, patch }) => repo.updateInvoiceLine(db, id, patch))
  handle('invoices:deleteLine', idSchema, (id) => repo.deleteInvoiceLine(db, id))

  handle('payments:create', createPaymentInputSchema, (input) => repo.recordPayment(db, input))
  handle('payments:delete', idSchema, (id) => repo.deletePayment(db, id))
  handle('payments:list', idSchema, (invoiceId) => repo.listPayments(db, invoiceId))

  handle('settings:get', z.undefined(), () => repo.getSettings(db))
  handle(
    'settings:update',
    updateSettingsInputSchema,
    (patch) => repo.updateSettings(db, patch),
    deps.onSettingsChanged
  )

  handle('sync:pendingCounts', z.undefined(), () => repo.pendingCounts(db))
}
