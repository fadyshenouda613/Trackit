import type { Database } from 'better-sqlite3'
import { invoiceStatusOf, invoiceTotals, nextInvoiceNumber, nextInvoiceSequence, paidCents } from '@trackit/shared/helpers'
import {
  invoiceLineSchema,
  invoiceSchema,
  paymentSchema,
  type CreatePaymentInput,
  type Invoice,
  type InvoiceLine,
  type InvoiceListFilters,
  type NewInvoiceInput,
  type NewInvoiceLineInput,
  type Payment,
  type Project,
  type UpdateInvoiceInput,
  type UpdateInvoiceLineInput,
  type VoidInvoiceInput
} from '@trackit/shared/schemas'
import { nowIso } from '../db/clock'
import { clientsTable } from './clients'
import { RepositoryError } from './errors'
import { projectsTable } from './projects'
import { getSettings } from './settings'
import {
  createRow,
  defineTable,
  getRow,
  requireRow,
  selectRows,
  softDeleteRow,
  updateRow,
  type CreateFields
} from './table'

/*
 * Invoices, their lines and their payments.
 *
 * Three rules hold the register together:
 *
 *   billing   only a delivered project can go on an invoice, and only if it
 *             is not already on one that is not void — a draft counts, so a
 *             project cannot be drafted twice
 *   copying   a line's label and amount are written into the line when it
 *             is created and never read back from the project
 *   deriving  sending flips the projects to invoiced, a settled balance
 *             flips them to paid, and voiding releases them to delivered
 */

export const invoicesTable = defineTable<Invoice>({
  name: 'invoices',
  label: 'invoice',
  schema: invoiceSchema,
  booleans: ['numberProvisional']
})

export const invoiceLinesTable = defineTable<InvoiceLine>({
  name: 'invoice_lines',
  label: 'invoice line',
  schema: invoiceLineSchema
})

export const paymentsTable = defineTable<Payment>({
  name: 'payments',
  label: 'payment',
  schema: paymentSchema
})

const DAY_MS = 86_400_000

/* ---- Reading ---------------------------------------------------------------- */

export const getInvoice = (db: Database, id: string): Invoice | null => getRow(db, invoicesTable, id)

export const listInvoiceLines = (db: Database, invoiceId: string): InvoiceLine[] =>
  selectRows(
    invoiceLinesTable,
    db.prepare(
      `SELECT * FROM invoice_lines
       WHERE invoice_id = @invoiceId AND deleted_at IS NULL
       ORDER BY sort_order, id`
    ),
    { invoiceId }
  )

export const listPayments = (db: Database, invoiceId: string): Payment[] =>
  selectRows(
    paymentsTable,
    db.prepare(
      `SELECT * FROM payments
       WHERE invoice_id = @invoiceId AND deleted_at IS NULL
       ORDER BY paid_at, id`
    ),
    { invoiceId }
  )

/** The live invoice a project is on — any status but void — or null. */
export function invoiceForProject(db: Database, projectId: string): Invoice | null {
  const [invoice] = selectRows(
    invoicesTable,
    db.prepare(
      `SELECT i.* FROM invoices i
       JOIN invoice_lines l ON l.invoice_id = i.id
       WHERE l.project_id = @projectId
         AND l.deleted_at IS NULL
         AND i.deleted_at IS NULL
         AND i.status <> 'void'
       ORDER BY i.created_at DESC LIMIT 1`
    ),
    { projectId }
  )
  return invoice ?? null
}

/** A client's delivered projects that no live invoice has claimed: what the Create invoice screen offers. */
export const listBillableProjects = (db: Database, clientId: string): Project[] =>
  selectRows(
    projectsTable,
    db.prepare(
      `SELECT p.* FROM projects p
       WHERE p.client_id = @clientId
         AND p.deleted_at IS NULL
         AND p.status = 'delivered'
         AND NOT EXISTS (
           SELECT 1 FROM invoice_lines l
           JOIN invoices i ON i.id = l.invoice_id
           WHERE l.project_id = p.id
             AND l.deleted_at IS NULL
             AND i.deleted_at IS NULL
             AND i.status <> 'void'
         )
       ORDER BY p.delivered_at DESC, p.name`
    ),
    { clientId }
  )

/**
 * The Invoices list: status and client filters and the four sorts. On the
 * two date sorts drafts come first — they have no date, and they are the
 * newest thing touched.
 */
export function listInvoices(db: Database, filters: InvoiceListFilters = {}): Invoice[] {
  const where = ['i.deleted_at IS NULL']
  const params: Record<string, unknown> = {}

  if (filters.status !== undefined) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    statuses.forEach((status, index) => {
      params[`status${index}`] = status
    })
    where.push(`i.status IN (${statuses.map((_, index) => `@status${index}`).join(', ')})`)
  }
  if (filters.clientId !== undefined) {
    where.push('i.client_id = @clientId')
    params['clientId'] = filters.clientId
  }

  const orderBy = {
    issued: 'i.issued_at IS NOT NULL, i.issued_at DESC, i.created_at DESC, i.number DESC',
    due: 'i.due_at IS NOT NULL, i.due_at DESC, i.created_at DESC, i.number DESC',
    total: 'i.total_cents DESC, i.number DESC',
    client: 'lower(c.company), lower(c.name), i.issued_at DESC, i.number DESC'
  }[filters.sort ?? 'issued']

  return selectRows(
    invoicesTable,
    db.prepare(
      `SELECT i.* FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}`
    ),
    params
  )
}

/* ---- Guards ----------------------------------------------------------------- */

function requireDraft(db: Database, id: string): Invoice {
  const invoice = requireRow(db, invoicesTable, id)
  if (invoice.status !== 'draft') {
    throw new RepositoryError('invalid_state', `${invoice.number} is ${invoice.status}; only a draft can be edited`)
  }
  return invoice
}

/**
 * The project a line may bill: not spoken for, and delivered. The invoice is
 * checked first because it is the more useful answer — a project that is
 * invoiced or paid is so *because* it is on one.
 */
function billableProject(db: Database, projectId: string): Project {
  const project = requireRow(db, projectsTable, projectId)
  const existing = invoiceForProject(db, projectId)
  if (existing) {
    throw new RepositoryError('already_billed', `${project.name} is already on ${existing.number}`)
  }
  if (project.status !== 'delivered') {
    throw new RepositoryError('not_billable', `${project.name} is ${project.status}; only a delivered project can be billed`)
  }
  return project
}

/**
 * A line as it will be stored. This is where the copy happens: a project
 * line without a label or amount takes the project's name and price now, and
 * keeps them whatever happens to the project later.
 */
function resolveLine(db: Database, invoiceId: string, line: NewInvoiceLineInput): CreateFields<InvoiceLine> {
  const base = {
    id: line.id,
    invoiceId,
    projectId: line.projectId,
    milestoneId: line.milestoneId,
    sortOrder: line.sortOrder
  }
  if (line.projectId === null) {
    // The schema has already insisted on both for a hand-typed line.
    return { ...base, label: line.label ?? '', amountCents: line.amountCents ?? 0 }
  }
  const project = billableProject(db, line.projectId)
  return {
    ...base,
    label: line.label ?? project.name,
    amountCents: line.amountCents ?? project.priceCents
  }
}

/** Recomputes the three snapshotted figures from the live lines. */
function retotal(db: Database, invoiceId: string): Invoice {
  const invoice = requireRow(db, invoicesTable, invoiceId)
  return updateRow(db, invoicesTable, invoiceId, invoiceTotals(listInvoiceLines(db, invoiceId), invoice.taxRate))
}

/** The projects on an invoice's live lines. */
function lineProjects(db: Database, invoiceId: string): Project[] {
  const projects: Project[] = []
  for (const line of listInvoiceLines(db, invoiceId)) {
    if (line.projectId === null) continue
    const project = getRow(db, projectsTable, line.projectId)
    if (project) projects.push(project)
  }
  return projects
}

/** Moves every line project currently in one of `from` to `to`. */
function flipProjects(db: Database, invoiceId: string, from: Project['status'][], to: Project['status']): void {
  for (const project of lineProjects(db, invoiceId)) {
    if (from.includes(project.status)) updateRow(db, projectsTable, project.id, { status: to })
  }
}

/**
 * The next number under the numbering scheme, past every number ever used
 * on this machine. This is the provisional number: what a draft carries
 * until the server, which counts across every machine, has issued one.
 */
export function nextNumber(db: Database): string {
  const scheme = getSettings(db).numberingScheme
  const used = db
    .prepare<[], { number: string }>('SELECT number FROM invoices')
    .all()
    .map((row) => row.number)
  const number = nextInvoiceNumber(scheme, nextInvoiceSequence(used, scheme), nowIso())
  if (number === null) {
    throw new RepositoryError('invalid_state', `The numbering scheme "${scheme}" has no counter`)
  }
  return number
}

/** The live drafts still carrying a number the local scheme guessed. */
export const listProvisionalInvoices = (db: Database): Invoice[] =>
  selectRows(
    invoicesTable,
    db.prepare(
      `SELECT * FROM invoices
       WHERE number_provisional = 1 AND deleted_at IS NULL
       ORDER BY created_at, id`
    )
  )

/**
 * The number an invoice is created under. The server's, when the caller
 * could reach it; otherwise the local scheme's, flagged so the sync engine
 * knows to replace it.
 */
export type InvoiceNumbering = { number: string; numberProvisional: boolean }

/* ---- Writing ---------------------------------------------------------------- */

/**
 * A draft with its lines. The currency defaults from the client; the number
 * is whatever the caller was issued, or — with nothing handed in — the local
 * scheme's provisional guess.
 */
export function createInvoice(db: Database, input: NewInvoiceInput, numbering?: InvoiceNumbering): Invoice {
  return db.transaction(() => {
    const client = requireRow(db, clientsTable, input.clientId)
    const issued = numbering ?? { number: nextNumber(db), numberProvisional: true }

    const seen = new Set<string>()
    const lines = input.lines.map((line) => {
      if (line.projectId !== null) {
        if (seen.has(line.projectId)) {
          throw new RepositoryError('already_billed', 'A project can only be on an invoice once')
        }
        seen.add(line.projectId)
      }
      return resolveLine(db, input.id, line)
    })

    const invoice = createRow(db, invoicesTable, {
      id: input.id,
      clientId: input.clientId,
      number: issued.number,
      numberProvisional: issued.numberProvisional,
      pdfGeneratedAt: null,
      status: 'draft',
      currency: input.currency ?? client.currency,
      issuedAt: null,
      dueAt: null,
      taxRate: input.taxRate,
      ...invoiceTotals(lines, input.taxRate),
      notes: input.notes,
      voidedAt: null,
      voidReason: null,
      replacedByInvoiceId: null
    })
    for (const line of lines) createRow(db, invoiceLinesTable, line)
    return invoice
  })()
}

/** On a draft: the notes, tax rate, currency or client. Everything else is derived, and the number is issued. */
export function updateInvoice(db: Database, id: string, patch: UpdateInvoiceInput): Invoice {
  return db.transaction(() => {
    requireDraft(db, id)
    const editable = new Set(['notes', 'taxRate', 'currency', 'clientId'])
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined && !editable.has(key)) {
        throw new RepositoryError('invalid_state', `${key} is set by the store, not edited`)
      }
    }
    const updated = updateRow(db, invoicesTable, id, patch)
    return patch.taxRate === undefined ? updated : retotal(db, id)
  })()
}

/**
 * The server's number in place of the provisional one. An ordinary edit —
 * stamped and pending — so the row goes up with its final number and any
 * other device holding the draft takes it on the next pull.
 */
export const assignInvoiceNumber = (db: Database, id: string, number: string): Invoice =>
  updateRow(db, invoicesTable, id, { number, numberProvisional: false })

/** When a PDF of the invoice was made. Any status: a draft prints as readily as a sent one. */
export const markPdfGenerated = (db: Database, id: string, at: string): Invoice =>
  updateRow(db, invoicesTable, id, { pdfGeneratedAt: at })

/** Drafts only: an issued invoice is voided, never deleted. The lines go with it, which frees their projects. */
export function deleteInvoice(db: Database, id: string): Invoice {
  return db.transaction(() => {
    requireDraft(db, id)
    for (const line of listInvoiceLines(db, id)) softDeleteRow(db, invoiceLinesTable, line.id)
    return softDeleteRow(db, invoicesTable, id)
  })()
}

export function addInvoiceLine(db: Database, invoiceId: string, line: NewInvoiceLineInput): InvoiceLine {
  return db.transaction(() => {
    requireDraft(db, invoiceId)
    const created = createRow(db, invoiceLinesTable, resolveLine(db, invoiceId, line))
    retotal(db, invoiceId)
    return created
  })()
}

/** Label, amount and position on a draft's line. A line does not move between invoices or projects. */
export function updateInvoiceLine(db: Database, id: string, patch: UpdateInvoiceLineInput): InvoiceLine {
  return db.transaction(() => {
    const line = requireRow(db, invoiceLinesTable, id)
    requireDraft(db, line.invoiceId)
    for (const key of ['invoiceId', 'projectId', 'milestoneId'] as const) {
      if (patch[key] !== undefined) {
        throw new RepositoryError('invalid_state', `A line's ${key} is fixed when it is created`)
      }
    }
    const updated = updateRow(db, invoiceLinesTable, id, patch)
    retotal(db, line.invoiceId)
    return updated
  })()
}

export function deleteInvoiceLine(db: Database, id: string): InvoiceLine {
  return db.transaction(() => {
    const line = requireRow(db, invoiceLinesTable, id)
    requireDraft(db, line.invoiceId)
    const deleted = softDeleteRow(db, invoiceLinesTable, id)
    retotal(db, line.invoiceId)
    return deleted
  })()
}

/**
 * Issues a draft: dated now, due after the client's terms, and every
 * delivered project on it becomes invoiced.
 */
export function sendInvoice(db: Database, id: string): Invoice {
  return db.transaction(() => {
    const invoice = requireDraft(db, id)
    if (listInvoiceLines(db, id).length === 0) {
      throw new RepositoryError('invalid_state', `${invoice.number} has no lines to send`)
    }
    const client = requireRow(db, clientsTable, invoice.clientId)
    const issuedAt = nowIso()
    const dueAt = new Date(Date.parse(issuedAt) + client.paymentTermsDays * DAY_MS).toISOString()
    const sent = updateRow(db, invoicesTable, id, { status: 'sent', issuedAt, dueAt })
    flipProjects(db, id, ['delivered'], 'invoiced')
    return sent
  })()
}

/** Reads the status off the balance and moves the projects with it. */
function settle(db: Database, invoiceId: string): Invoice {
  const invoice = requireRow(db, invoicesTable, invoiceId)
  if (invoice.status === 'draft' || invoice.status === 'void') return invoice

  const status = invoiceStatusOf({
    voided: false,
    issued: true,
    totalCents: invoice.totalCents,
    paidCents: paidCents(listPayments(db, invoiceId))
  })
  const settled = status === invoice.status ? invoice : updateRow(db, invoicesTable, invoiceId, { status })

  if (status === 'paid') flipProjects(db, invoiceId, ['invoiced'], 'paid')
  else flipProjects(db, invoiceId, ['paid'], 'invoiced')

  return settled
}

/** Money against an issued invoice. Payments that reach the total settle it. */
export function recordPayment(db: Database, input: CreatePaymentInput): Payment {
  return db.transaction(() => {
    const invoice = requireRow(db, invoicesTable, input.invoiceId)
    if (invoice.status === 'draft' || invoice.status === 'void') {
      throw new RepositoryError('invalid_state', `${invoice.number} is ${invoice.status}; nothing can be paid against it`)
    }
    const payment = createRow(db, paymentsTable, input)
    settle(db, invoice.id)
    return payment
  })()
}

/** Removes a payment and reads the balance again. */
export function deletePayment(db: Database, id: string): Payment {
  return db.transaction(() => {
    const payment = softDeleteRow(db, paymentsTable, id)
    settle(db, payment.invoiceId)
    return payment
  })()
}

/**
 * Voids an issued invoice and releases its projects back to delivered, where
 * they can be billed again. A draft was never issued, so it is deleted rather
 * than voided.
 */
export function voidInvoice(db: Database, id: string, input: VoidInvoiceInput): Invoice {
  return db.transaction(() => {
    const invoice = requireRow(db, invoicesTable, id)
    if (invoice.status === 'void') {
      throw new RepositoryError('invalid_state', `${invoice.number} is already void`)
    }
    if (invoice.status === 'draft') {
      throw new RepositoryError('invalid_state', `${invoice.number} was never issued; delete the draft instead`)
    }
    if (input.replacedByInvoiceId !== null) requireRow(db, invoicesTable, input.replacedByInvoiceId)

    const voided = updateRow(db, invoicesTable, id, {
      status: 'void',
      voidedAt: nowIso(),
      voidReason: input.reason,
      replacedByInvoiceId: input.replacedByInvoiceId
    })
    flipProjects(db, id, ['invoiced', 'paid'], 'delivered')
    return voided
  })()
}
