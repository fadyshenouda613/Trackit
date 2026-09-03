import { beforeEach, describe, expect, it } from 'vitest'
import type { Client, Project } from '@trackit/shared/schemas'
import { openMemoryDatabase, type Database } from '../db'
import {
  createInvoice,
  deleteInvoice,
  deletePayment,
  getInvoice,
  invoiceForProject,
  listBillableProjects,
  listInvoiceLines,
  listInvoices,
  recordPayment,
  sendInvoice,
  voidInvoice
} from './invoices'
import { getProject, updateProject } from './projects'
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

  it('numbers the invoice from the scheme and takes the currency from the client', () => {
    updateSettings(db, { numberingScheme: 'INV-0000' })
    const first = draftFor(aProject(db, client, 'delivered'))
    expect(first.number).toBe('INV-0001')
    expect(first.currency).toBe('USD')
    const second = draftFor(aProject(db, client, 'delivered'))
    expect(second.number).toBe('INV-0002')
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
