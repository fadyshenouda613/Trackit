import { beforeEach, describe, expect, it } from 'vitest'
import { paidCents } from '@trackit/shared/helpers'
import type { Client, InvoiceLine, NewInvoiceLineInput, Project } from '@trackit/shared/schemas'
import { openMemoryDatabase, type Database } from '../db'
import { RepositoryError } from './errors'
import {
  addInvoiceLine,
  assignInvoiceNumber,
  createInvoice,
  deleteInvoice,
  deleteInvoiceLine,
  deletePayment,
  getInvoice,
  invoiceForProject,
  listBillableProjects,
  listInvoiceLines,
  listInvoices,
  listPayments,
  listProvisionalInvoices,
  markPdfGenerated,
  recordPayment,
  sendInvoice,
  updateInvoice,
  updateInvoiceLine,
  voidInvoice
} from './invoices'
import { deleteProject, getProject, updateProject } from './projects'
import { updateSettings } from './settings'
import { aClient, aProject, id } from './test-support'

let db: Database
let client: Client

beforeEach(() => {
  db = openMemoryDatabase()
  client = aClient(db)
})

const refusedAs = (code: string) => expect.objectContaining({ code })

const line = (project: Project, sortOrder = 1) => ({
  id: id(),
  projectId: project.id,
  milestoneId: null,
  sortOrder
})

const draftFor = (project: Project, taxRate = 0) =>
  createInvoice(db, {
    id: id(),
    clientId: client.id,
    taxRate,
    notes: '',
    lines: [line(project)]
  })

const pay = (invoiceId: string, amountCents: number) =>
  recordPayment(db, {
    id: id(),
    invoiceId,
    paidAt: '2026-08-24T12:00:00.000Z',
    amountCents,
    method: 'bank_transfer',
    note: null
  })

/** A line typed by hand: nothing to copy from, so it carries its own label and amount. */
const typed = (sortOrder = 1, amountCents = 120000): NewInvoiceLineInput => ({
  id: id(),
  projectId: null,
  milestoneId: null,
  label: 'Print-ready files',
  amountCents,
  sortOrder
})

const draftOf = (lines: NewInvoiceLineInput[], taxRate = 0) =>
  createInvoice(db, { id: id(), clientId: client.id, taxRate, notes: '', lines })

const lineOf = (invoiceId: string): InvoiceLine => {
  const [first] = listInvoiceLines(db, invoiceId)
  if (!first) throw new Error(`No line on ${invoiceId}`)
  return first
}

describe('guard one: only a delivered project can be billed', () => {
  it('refuses a draft, an active and a cancelled project', () => {
    for (const status of ['draft', 'active'] as const) {
      const project = aProject(db, client, status)
      expect(() => draftFor(project)).toThrow(refusedAs('not_billable'))
    }
    expect(listInvoices(db)).toEqual([])
  })

  it('accepts a delivered one and lists it as billable until then', () => {
    const project = aProject(db, client, 'delivered')
    expect(listBillableProjects(db, client.id).map((entry) => entry.id)).toEqual([project.id])

    const invoice = draftFor(project)
    expect(invoice.status).toBe('draft')
    expect(listBillableProjects(db, client.id)).toEqual([])
    expect(invoiceForProject(db, project.id)?.id).toBe(invoice.id)
  })

  // BUG (apps/desktop/src/main/repositories/invoices.ts, billableProject): the
  // check is "delivered and not on a live invoice", never "this client's". A
  // draft raised for one client takes another client's delivered project
  // without complaint, and listBillableProjects would never have offered it.
  it('refuses a project that belongs to another client', () => {
    const other = aClient(db, { name: 'Sam Okafor', company: 'Okafor & Co' })
    const theirs = aProject(db, other, 'delivered')
    expect(() => draftFor(theirs)).toThrow(RepositoryError)
    expect(listInvoices(db)).toEqual([])
  })
})

describe('guard two: a project on a live invoice cannot go on another', () => {
  it('refuses while the first invoice is a draft, sent or paid', () => {
    const project = aProject(db, client, 'delivered')
    const first = draftFor(project)
    expect(() => draftFor(project)).toThrow(refusedAs('already_billed'))

    sendInvoice(db, first.id)
    expect(() => draftFor(project)).toThrow(refusedAs('already_billed'))

    pay(first.id, first.totalCents)
    expect(() => draftFor(project)).toThrow(refusedAs('already_billed'))
  })

  it('refuses the same project twice on one invoice', () => {
    const project = aProject(db, client, 'delivered')
    expect(() =>
      createInvoice(db, {
        id: id(),
        clientId: client.id,
        taxRate: 0,
        notes: '',
        lines: [line(project, 1), line(project, 2)]
      })
    ).toThrow(refusedAs('already_billed'))
    expect(listInvoices(db)).toEqual([])
  })

  it('allows it again once the first invoice is void or the draft is deleted', () => {
    const project = aProject(db, client, 'delivered')
    const first = draftFor(project)
    deleteInvoice(db, first.id)
    const second = draftFor(project)
    sendInvoice(db, second.id)

    expect(() => draftFor(project)).toThrow(refusedAs('already_billed'))
    voidInvoice(db, second.id, { reason: 'Issued to the wrong client', replacedByInvoiceId: null })
    expect(draftFor(project).status).toBe('draft')
  })
})

describe('guard three: the line is a copy', () => {
  it('takes the project name and price at creation and keeps them afterwards', () => {
    const project = aProject(db, client, 'delivered', { name: 'Trade show panels', priceCents: 340000 })
    const invoice = draftFor(project, 8.5)

    const [copied] = listInvoiceLines(db, invoice.id)
    expect(copied).toMatchObject({ label: 'Trade show panels', amountCents: 340000, projectId: project.id })
    expect(invoice).toMatchObject({ subtotalCents: 340000, taxCents: 28900, totalCents: 368900 })

    updateProject(db, project.id, { name: 'Trade show panels, revised', priceCents: 400000 })

    expect(listInvoiceLines(db, invoice.id)[0]).toMatchObject({ label: 'Trade show panels', amountCents: 340000 })
    expect(getInvoice(db, invoice.id)?.totalCents).toBe(368900)
  })

  it('keeps a label and amount the caller wrote instead', () => {
    const project = aProject(db, client, 'delivered')
    const invoice = createInvoice(db, {
      id: id(),
      clientId: client.id,
      taxRate: 0,
      notes: '',
      lines: [{ ...line(project), label: 'Panel system layout, six panels', amountCents: 200000 }]
    })
    expect(listInvoiceLines(db, invoice.id)[0]).toMatchObject({
      label: 'Panel system layout, six panels',
      amountCents: 200000
    })
  })

  it('outlives its project', () => {
    const project = aProject(db, client, 'delivered', { name: 'Trade show panels', priceCents: 340000 })
    const invoice = draftFor(project)
    deleteProject(db, project.id)
    expect(listInvoiceLines(db, invoice.id)[0]).toMatchObject({ label: 'Trade show panels', amountCents: 340000 })
    expect(getInvoice(db, invoice.id)?.totalCents).toBe(340000)
  })

  it('numbers the invoice from the scheme, provisionally, and takes the currency from the client', () => {
    updateSettings(db, { numberingScheme: 'INV-0000' })
    const first = draftFor(aProject(db, client, 'delivered'))
    expect(first.number).toBe('INV-0001')
    expect(first.numberProvisional).toBe(true)
    expect(first.pdfGeneratedAt).toBeNull()
    expect(first.currency).toBe('USD')
    const second = draftFor(aProject(db, client, 'delivered'))
    expect(second.number).toBe('INV-0002')
  })

  it('stores the number the server issued when it is handed one', () => {
    const project = aProject(db, client, 'delivered')
    const invoice = createInvoice(
      db,
      { id: id(), clientId: client.id, taxRate: 0, notes: '', lines: [line(project)] },
      { number: 'INV-0150', numberProvisional: false }
    )
    expect(invoice).toMatchObject({ number: 'INV-0150', numberProvisional: false })
  })
})

describe('numbering', () => {
  it('lists the live provisional drafts, and only them', () => {
    updateSettings(db, { numberingScheme: 'INV-0000' })
    const provisional = draftFor(aProject(db, client, 'delivered'))
    const issued = createInvoice(
      db,
      { id: id(), clientId: client.id, taxRate: 0, notes: '', lines: [line(aProject(db, client, 'delivered'))] },
      { number: 'INV-0150', numberProvisional: false }
    )
    const gone = draftFor(aProject(db, client, 'delivered'))
    deleteInvoice(db, gone.id)

    const listed = listProvisionalInvoices(db).map((entry) => entry.id)
    expect(listed).toEqual([provisional.id])
    expect(listed).not.toContain(issued.id)
  })

  it('assigns the server number as an ordinary edit: flag cleared, stamped, pending', () => {
    updateSettings(db, { numberingScheme: 'INV-0000' })
    const draft = draftFor(aProject(db, client, 'delivered'))
    db.prepare("UPDATE invoices SET sync_state = 'synced' WHERE id = ?").run(draft.id)

    const numbered = assignInvoiceNumber(db, draft.id, 'INV-0007')
    expect(numbered).toMatchObject({ number: 'INV-0007', numberProvisional: false, syncState: 'pending' })
    expect(Date.parse(numbered.updatedAt)).toBeGreaterThan(Date.parse(draft.updatedAt))
    expect(listProvisionalInvoices(db)).toEqual([])
  })

  it('refuses a number typed onto a draft: it is issued, not edited', () => {
    const draft = draftFor(aProject(db, client, 'delivered'))
    expect(() => updateInvoice(db, draft.id, { number: 'INV-9999' })).toThrow(refusedAs('invalid_state'))
    expect(updateInvoice(db, draft.id, { notes: 'Bank details as before.' }).notes).toBe('Bank details as before.')
  })

  it('stamps when a PDF was made, on any status', () => {
    const draft = draftFor(aProject(db, client, 'delivered'))
    expect(markPdfGenerated(db, draft.id, '2026-09-11T10:00:00.000Z').pdfGeneratedAt).toBe('2026-09-11T10:00:00.000Z')
    const sent = sendInvoice(db, draft.id)
    const stamped = markPdfGenerated(db, sent.id, '2026-09-11T11:00:00.000Z')
    expect(stamped.pdfGeneratedAt).toBe('2026-09-11T11:00:00.000Z')
    expect(stamped.status).toBe('sent')
  })

  it('counts every number ever used here: deleted drafts, voids and server-issued ones alike', () => {
    updateSettings(db, { numberingScheme: 'INV-0000' })
    const gone = draftFor(aProject(db, client, 'delivered'))
    expect(gone.number).toBe('INV-0001')
    deleteInvoice(db, gone.id)
    expect(draftFor(aProject(db, client, 'delivered')).number).toBe('INV-0002')

    const wrong = sendInvoice(db, draftFor(aProject(db, client, 'delivered')).id)
    expect(wrong.number).toBe('INV-0003')
    voidInvoice(db, wrong.id, { reason: 'Sent in error', replacedByInvoiceId: null })
    expect(draftFor(aProject(db, client, 'delivered')).number).toBe('INV-0004')

    createInvoice(
      db,
      { id: id(), clientId: client.id, taxRate: 0, notes: '', lines: [typed()] },
      { number: 'INV-0150', numberProvisional: false }
    )
    expect(draftFor(aProject(db, client, 'delivered')).number).toBe('INV-0151')
  })

  it('grows past the padding rather than wrapping', () => {
    updateSettings(db, { numberingScheme: 'INV-0000' })
    createInvoice(
      db,
      { id: id(), clientId: client.id, taxRate: 0, notes: '', lines: [typed()] },
      { number: 'INV-9999', numberProvisional: false }
    )
    expect(draftOf([typed()]).number).toBe('INV-10000')
    expect(draftOf([typed()]).number).toBe('INV-10001')
  })

  it('starts a changed scheme at one, and picks the old count back up', () => {
    updateSettings(db, { numberingScheme: 'INV-0000' })
    expect(draftOf([typed()]).number).toBe('INV-0001')

    updateSettings(db, { numberingScheme: '{YYYY}-000' })
    const year = new Date().getUTCFullYear()
    expect(draftOf([typed()]).number).toBe(`${year}-001`)
    expect(draftOf([typed()]).number).toBe(`${year}-002`)

    updateSettings(db, { numberingScheme: 'INV-0000' })
    expect(draftOf([typed()]).number).toBe('INV-0002')
  })
})

describe('what an invoice does to its projects', () => {
  it('marks them invoiced when sent, with a due date from the client terms', () => {
    const project = aProject(db, client, 'delivered')
    const invoice = draftFor(project)
    expect(getProject(db, project.id)?.status).toBe('delivered')

    const sent = sendInvoice(db, invoice.id)
    expect(sent.status).toBe('sent')
    expect(sent.issuedAt).not.toBeNull()
    expect(Date.parse(sent.dueAt ?? '') - Date.parse(sent.issuedAt ?? '')).toBe(14 * 86_400_000)
    expect(getProject(db, project.id)?.status).toBe('invoiced')
    expect(() => sendInvoice(db, invoice.id)).toThrow(refusedAs('invalid_state'))
  })

  it('marks them paid once payments reach the total, and partial before that', () => {
    const project = aProject(db, client, 'delivered', { priceCents: 800000 })
    const invoice = sendInvoice(db, draftFor(project).id)

    pay(invoice.id, 500000)
    expect(getInvoice(db, invoice.id)?.status).toBe('partial')
    expect(getProject(db, project.id)?.status).toBe('invoiced')

    const settling = pay(invoice.id, 300000)
    expect(settling.amountCents).toBe(300000)
    expect(getInvoice(db, invoice.id)?.status).toBe('paid')
    expect(getProject(db, project.id)?.status).toBe('paid')

    deletePayment(db, settling.id)
    expect(getInvoice(db, invoice.id)?.status).toBe('partial')
    expect(getProject(db, project.id)?.status).toBe('invoiced')
  })

  it('refuses payments against a draft or a void', () => {
    const project = aProject(db, client, 'delivered')
    const draft = draftFor(project)
    expect(() => pay(draft.id, 100)).toThrow(refusedAs('invalid_state'))
    // A draft was never issued, so it cannot be voided either: it is deleted.
    expect(() => voidInvoice(db, draft.id, { reason: 'Never sent', replacedByInvoiceId: null })).toThrow(
      refusedAs('invalid_state')
    )

    sendInvoice(db, draft.id)
    voidInvoice(db, draft.id, { reason: 'Sent in error', replacedByInvoiceId: null })
    expect(() => pay(draft.id, 100)).toThrow(refusedAs('invalid_state'))
  })

  it('releases them to delivered when voided, naming the replacement', () => {
    const project = aProject(db, client, 'delivered')
    const wrong = sendInvoice(db, draftFor(project).id)
    pay(wrong.id, wrong.totalCents)
    expect(getProject(db, project.id)?.status).toBe('paid')

    const voided = voidInvoice(db, wrong.id, { reason: 'Issued to the wrong client', replacedByInvoiceId: null })
    expect(voided.status).toBe('void')
    expect(voided.voidedAt).not.toBeNull()
    expect(voided.voidReason).toBe('Issued to the wrong client')
    expect(getProject(db, project.id)?.status).toBe('delivered')
    expect(listBillableProjects(db, client.id).map((entry) => entry.id)).toEqual([project.id])

    const reissued = draftFor(project)
    expect(() => voidInvoice(db, wrong.id, { reason: 'Again', replacedByInvoiceId: reissued.id })).toThrow(
      refusedAs('invalid_state')
    )
  })
})

describe('guard four: only a draft is edited', () => {
  it('adds, edits and removes lines on a draft, retotalling each time', () => {
    const invoice = draftFor(aProject(db, client, 'delivered', { priceCents: 340000 }), 8.5)

    const added = addInvoiceLine(db, invoice.id, typed(2))
    expect(added).toMatchObject({ invoiceId: invoice.id, projectId: null, label: 'Print-ready files', amountCents: 120000 })
    expect(getInvoice(db, invoice.id)).toMatchObject({ subtotalCents: 460000, taxCents: 39100, totalCents: 499100 })

    const edited = updateInvoiceLine(db, added.id, { label: 'Print-ready files, two sizes', amountCents: 150000, sortOrder: 0.5 })
    expect(edited).toMatchObject({ label: 'Print-ready files, two sizes', amountCents: 150000, sortOrder: 0.5 })
    expect(lineOf(invoice.id).id).toBe(added.id)
    expect(getInvoice(db, invoice.id)).toMatchObject({ subtotalCents: 490000, taxCents: 41650, totalCents: 531650 })

    const removed = deleteInvoiceLine(db, added.id)
    expect(removed.deletedAt).not.toBeNull()
    expect(listInvoiceLines(db, invoice.id).map((entry) => entry.id)).not.toContain(added.id)
    expect(getInvoice(db, invoice.id)).toMatchObject({ subtotalCents: 340000, taxCents: 28900, totalCents: 368900 })
    expect(() => deleteInvoiceLine(db, added.id)).toThrow(refusedAs('not_found'))
  })

  it('holds a line to the invoice and project it was created on', () => {
    const invoice = draftFor(aProject(db, client, 'delivered'))
    const other = draftOf([typed()])
    const first = lineOf(invoice.id)
    expect(() => updateInvoiceLine(db, first.id, { invoiceId: other.id })).toThrow(refusedAs('invalid_state'))
    expect(() => updateInvoiceLine(db, first.id, { projectId: null })).toThrow(refusedAs('invalid_state'))
    expect(() => updateInvoiceLine(db, first.id, { milestoneId: id() })).toThrow(refusedAs('invalid_state'))
    expect(lineOf(invoice.id)).toEqual(first)
  })

  it('adds a project line under the same billing rules as raising the draft', () => {
    const project = aProject(db, client, 'delivered')
    const invoice = draftFor(project)
    expect(() => addInvoiceLine(db, invoice.id, line(project, 2))).toThrow(refusedAs('already_billed'))
    expect(() => addInvoiceLine(db, invoice.id, line(aProject(db, client, 'active'), 2))).toThrow(refusedAs('not_billable'))
    const elsewhere = aProject(db, client, 'delivered')
    draftFor(elsewhere)
    expect(() => addInvoiceLine(db, invoice.id, line(elsewhere, 2))).toThrow(refusedAs('already_billed'))
    expect(listInvoiceLines(db, invoice.id)).toHaveLength(1)
    expect(getInvoice(db, invoice.id)?.totalCents).toBe(invoice.totalCents)
  })

  it('refuses every edit, and deletion, once the invoice is issued', () => {
    const sent = sendInvoice(db, draftFor(aProject(db, client, 'delivered')).id)
    const existing = lineOf(sent.id)
    expect(() => addInvoiceLine(db, sent.id, typed(2))).toThrow(refusedAs('invalid_state'))
    expect(() => updateInvoiceLine(db, existing.id, { amountCents: 1 })).toThrow(refusedAs('invalid_state'))
    expect(() => deleteInvoiceLine(db, existing.id)).toThrow(refusedAs('invalid_state'))
    expect(() => updateInvoice(db, sent.id, { taxRate: 20 })).toThrow(refusedAs('invalid_state'))
    expect(() => updateInvoice(db, sent.id, { notes: 'Late' })).toThrow(refusedAs('invalid_state'))
    expect(() => deleteInvoice(db, sent.id)).toThrow(refusedAs('invalid_state'))

    pay(sent.id, sent.totalCents)
    expect(() => updateInvoiceLine(db, existing.id, { label: 'Renamed' })).toThrow(refusedAs('invalid_state'))
    voidInvoice(db, sent.id, { reason: 'Closed', replacedByInvoiceId: null })
    expect(() => deleteInvoiceLine(db, existing.id)).toThrow(refusedAs('invalid_state'))

    expect(lineOf(sent.id)).toEqual(existing)
    expect(getInvoice(db, sent.id)).toMatchObject({ status: 'void', totalCents: sent.totalCents, deletedAt: null })
  })

  it('lets a draft change only its notes, tax rate, currency and client', () => {
    const draft = draftFor(aProject(db, client, 'delivered', { priceCents: 100000 }), 8.5)
    expect(() => updateInvoice(db, draft.id, { status: 'paid' })).toThrow(refusedAs('invalid_state'))
    expect(() => updateInvoice(db, draft.id, { totalCents: 1 })).toThrow(refusedAs('invalid_state'))
    expect(() => updateInvoice(db, draft.id, { issuedAt: '2026-08-24T12:00:00.000Z' })).toThrow(refusedAs('invalid_state'))
    expect(getInvoice(db, draft.id)).toMatchObject({ status: 'draft', issuedAt: null, totalCents: 108500 })

    expect(updateInvoice(db, draft.id, { taxRate: 20 })).toMatchObject({ subtotalCents: 100000, taxCents: 20000, totalCents: 120000 })
    expect(updateInvoice(db, draft.id, { taxRate: 0 })).toMatchObject({ taxCents: 0, totalCents: 100000 })
    expect(updateInvoice(db, draft.id, { currency: 'EUR' }).currency).toBe('EUR')
    const other = aClient(db, { name: 'Sam Okafor', company: 'Okafor & Co' })
    expect(updateInvoice(db, draft.id, { clientId: other.id }).clientId).toBe(other.id)
  })
})

describe('currency', () => {
  it('is the client’s unless one is given', () => {
    const sterling = aClient(db, { currency: 'GBP' })
    const project = aProject(db, sterling, 'delivered', { currency: 'GBP' })
    const defaulted = createInvoice(db, { id: id(), clientId: sterling.id, taxRate: 0, notes: '', lines: [line(project)] })
    expect(defaulted.currency).toBe('GBP')
    /* Stated, it is the invoice's own; the schema offers the override on purpose. */
    const stated = createInvoice(db, { id: id(), clientId: sterling.id, currency: 'EUR', taxRate: 0, notes: '', lines: [typed()] })
    expect(stated.currency).toBe('EUR')
  })
})

describe('payments', () => {
  it('refuses a zero or negative amount, writing nothing', () => {
    const sent = sendInvoice(db, draftFor(aProject(db, client, 'delivered')).id)
    /* The schema's rule, met again at the row: zero is not a payment, and neither is a refund. */
    expect(() => pay(sent.id, 0)).toThrow(expect.objectContaining({ name: 'ZodError' }))
    expect(() => pay(sent.id, -100)).toThrow(expect.objectContaining({ name: 'ZodError' }))
    expect(listPayments(db, sent.id)).toEqual([])
    expect(getInvoice(db, sent.id)?.status).toBe('sent')
  })

  it('takes an overpayment, and one more against a settled invoice, as paid', () => {
    const project = aProject(db, client, 'delivered', { priceCents: 800000 })
    const sent = sendInvoice(db, draftFor(project).id)
    pay(sent.id, 500000)
    const over = pay(sent.id, 400000)
    expect(getInvoice(db, sent.id)?.status).toBe('paid')
    expect(getProject(db, project.id)?.status).toBe('paid')
    expect(paidCents(listPayments(db, sent.id))).toBe(900000)

    pay(sent.id, 1)
    expect(getInvoice(db, sent.id)?.status).toBe('paid')

    /* Removing the overpayment reads the balance again: 500001 against 800000. */
    deletePayment(db, over.id)
    expect(getInvoice(db, sent.id)?.status).toBe('partial')
    expect(getProject(db, project.id)?.status).toBe('invoiced')
  })

  it('needs an invoice, and a payment is only removed once', () => {
    expect(() => pay(id(), 100)).toThrow(refusedAs('not_found'))
    const sent = sendInvoice(db, draftFor(aProject(db, client, 'delivered')).id)
    const payment = pay(sent.id, 100)
    expect(getInvoice(db, sent.id)?.status).toBe('partial')
    deletePayment(db, payment.id)
    expect(getInvoice(db, sent.id)?.status).toBe('sent')
    expect(() => deletePayment(db, payment.id)).toThrow(refusedAs('not_found'))
    expect(() => deletePayment(db, id())).toThrow(refusedAs('not_found'))
  })

  it('stay on a voided invoice, and removing one does not revive it', () => {
    const project = aProject(db, client, 'delivered')
    const sent = sendInvoice(db, draftFor(project).id)
    const payment = pay(sent.id, sent.totalCents)
    voidInvoice(db, sent.id, { reason: 'Paid twice by mistake', replacedByInvoiceId: null })
    expect(listPayments(db, sent.id).map((entry) => entry.id)).toEqual([payment.id])

    deletePayment(db, payment.id)
    expect(getInvoice(db, sent.id)?.status).toBe('void')
    expect(getProject(db, project.id)?.status).toBe('delivered')
  })
})

describe('voiding', () => {
  it('names the invoice reissued in its place', () => {
    const wrong = sendInvoice(db, draftFor(aProject(db, client, 'delivered')).id)
    const reissue = draftOf([typed()])
    const voided = voidInvoice(db, wrong.id, { reason: 'Wrong amount', replacedByInvoiceId: reissue.id })
    expect(voided.replacedByInvoiceId).toBe(reissue.id)
    expect(getInvoice(db, reissue.id)?.status).toBe('draft')
  })

  it('refuses a replacement that does not exist or was deleted, and changes nothing', () => {
    const project = aProject(db, client, 'delivered')
    const wrong = sendInvoice(db, draftFor(project).id)
    const gone = draftOf([typed()])
    deleteInvoice(db, gone.id)
    expect(() => voidInvoice(db, wrong.id, { reason: 'Wrong amount', replacedByInvoiceId: id() })).toThrow(
      refusedAs('not_found')
    )
    expect(() => voidInvoice(db, wrong.id, { reason: 'Wrong amount', replacedByInvoiceId: gone.id })).toThrow(
      refusedAs('not_found')
    )
    expect(getInvoice(db, wrong.id)).toMatchObject({ status: 'sent', voidedAt: null, voidReason: null })
    expect(getProject(db, project.id)?.status).toBe('invoiced')
  })

  // BUG (apps/desktop/src/main/repositories/invoices.ts, voidInvoice): the only
  // check on replacedByInvoiceId is that it names a live invoice, and the one
  // being voided still is at that moment — so an invoice is accepted as its
  // own replacement and stored pointing at itself.
  it('refuses an invoice as its own replacement', () => {
    const wrong = sendInvoice(db, draftFor(aProject(db, client, 'delivered')).id)
    expect(() => voidInvoice(db, wrong.id, { reason: 'Wrong amount', replacedByInvoiceId: wrong.id })).toThrow(
      refusedAs('invalid_state')
    )
  })
})

describe('sending', () => {
  it('refuses a draft whose lines are all gone', () => {
    const draft = draftOf([typed()])
    deleteInvoiceLine(db, lineOf(draft.id).id)
    expect(getInvoice(db, draft.id)).toMatchObject({ subtotalCents: 0, taxCents: 0, totalCents: 0 })
    expect(() => sendInvoice(db, draft.id)).toThrow(refusedAs('invalid_state'))
    expect(getInvoice(db, draft.id)).toMatchObject({ status: 'draft', issuedAt: null })
  })

  it('is due on receipt when the client has no terms', () => {
    const immediate = aClient(db, { paymentTermsDays: 0 })
    const project = aProject(db, immediate, 'delivered')
    const draft = createInvoice(db, { id: id(), clientId: immediate.id, taxRate: 0, notes: '', lines: [line(project)] })
    const sent = sendInvoice(db, draft.id)
    expect(sent.dueAt).toBe(sent.issuedAt)
  })

  it('cannot send a deleted draft, whose lines went with it', () => {
    const project = aProject(db, client, 'delivered')
    const draft = draftFor(project)
    deleteInvoice(db, draft.id)
    expect(listInvoiceLines(db, draft.id)).toEqual([])
    expect(() => sendInvoice(db, draft.id)).toThrow(refusedAs('not_found'))
    expect(getProject(db, project.id)?.status).toBe('delivered')
  })
})
