import { describe, expect, it } from 'vitest'
import {
  authStatusSchema,
  authUserSchema,
  centsSchema,
  checklistItemSchema,
  clientSchema,
  createChecklistItemInputSchema,
  createClientInputSchema,
  createInvoiceInputSchema,
  createInvoiceLineInputSchema,
  createMilestoneInputSchema,
  createNoteInputSchema,
  createPaymentInputSchema,
  createProjectInputSchema,
  createTimeEntryInputSchema,
  idSchema,
  invoiceSchema,
  invoiceStatusSchema,
  loginInputSchema,
  milestoneSchema,
  noteSchema,
  PASSWORD_MIN_LENGTH,
  paymentMethodLabels,
  paymentMethodSchema,
  paymentSchema,
  pendingCountsSchema,
  projectSchema,
  projectStatusSchema,
  registerInputSchema,
  settingsSchema,
  startTimerInputSchema,
  timeEntrySchema,
  timestampSchema,
  updateClientInputSchema,
  updateInvoiceInputSchema,
  updateNoteInputSchema,
  updateSettingsInputSchema,
  updateTimeEntryInputSchema
} from './index'

/* Fixed v4 UUIDs: version nibble 4, variant nibble 8. */
const ID = '4f1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const OTHER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e'
const V1_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

const AT = '2026-08-28T09:15:00.000Z'

const base = {
  id: ID,
  createdAt: AT,
  updatedAt: AT,
  deletedAt: null,
  syncState: 'pending' as const
}

describe('primitives', () => {
  it('accepts only v4 uuids as ids', () => {
    expect(idSchema.safeParse(ID).success).toBe(true)
    expect(idSchema.safeParse(V1_UUID).success).toBe(false)
    expect(idSchema.safeParse('not-an-id').success).toBe(false)
  })

  it('accepts only integer cents', () => {
    expect(centsSchema.safeParse(650000).success).toBe(true)
    expect(centsSchema.safeParse(-5).success).toBe(true)
    expect(centsSchema.safeParse(12.5).success).toBe(false)
  })

  it('accepts only UTC ISO timestamps', () => {
    expect(timestampSchema.safeParse(AT).success).toBe(true)
    expect(timestampSchema.safeParse('2026-08-28T09:15:00Z').success).toBe(true)
    /* Date-only and local-offset forms are the two ways a stored time drifts. */
    expect(timestampSchema.safeParse('2026-08-28').success).toBe(false)
    expect(timestampSchema.safeParse('2026-08-28T09:15:00+02:00').success).toBe(false)
  })
})

describe('client', () => {
  const fields = {
    name: 'Priya Raghunathan',
    company: 'Northwind Studio',
    email: 'priya@northwindstudio.com',
    phone: '+1 415 555 0182',
    address: '418 Turk Street\nSan Francisco, CA 94102',
    currency: 'USD' as const,
    paymentTermsDays: 14,
    notes: ''
  }

  it('parses a stored row', () => {
    expect(clientSchema.parse({ ...base, ...fields })).toEqual({ ...base, ...fields })
  })

  it('create carries the client-minted id and none of the store columns', () => {
    expect(createClientInputSchema.safeParse({ id: ID, ...fields }).success).toBe(true)
    expect(createClientInputSchema.safeParse(fields).success).toBe(false)
    expect(Object.keys(createClientInputSchema.shape)).not.toContain('createdAt')
    expect(Object.keys(createClientInputSchema.shape)).not.toContain('syncState')
  })

  it('update is any subset, without the id', () => {
    expect(updateClientInputSchema.parse({ paymentTermsDays: 30 })).toEqual({
      paymentTermsDays: 30
    })
    expect(Object.keys(updateClientInputSchema.shape)).not.toContain('id')
  })

  it('requires a contact name but not a company', () => {
    expect(clientSchema.safeParse({ ...base, ...fields, name: '   ' }).success).toBe(false)
    expect(clientSchema.safeParse({ ...base, ...fields, company: '' }).success).toBe(true)
  })

  it('takes an empty email or a real one, nothing in between', () => {
    expect(clientSchema.safeParse({ ...base, ...fields, email: '' }).success).toBe(true)
    expect(clientSchema.safeParse({ ...base, ...fields, email: 'priya' }).success).toBe(false)
  })

  it('rejects negative terms', () => {
    expect(clientSchema.safeParse({ ...base, ...fields, paymentTermsDays: -1 }).success).toBe(false)
    expect(clientSchema.safeParse({ ...base, ...fields, paymentTermsDays: 0 }).success).toBe(true)
  })
})

describe('project', () => {
  const fields = {
    clientId: OTHER,
    name: 'Brand refresh',
    description: '',
    priceCents: 650000,
    currency: 'USD' as const,
    budgetedHours: 32,
    status: 'active' as const,
    kickoffAt: AT,
    dueAt: '2026-09-11T00:00:00.000Z',
    deliveredAt: null
  }

  it('parses a stored row and a create input', () => {
    expect(projectSchema.safeParse({ ...base, ...fields }).success).toBe(true)
    expect(createProjectInputSchema.safeParse({ id: ID, ...fields }).success).toBe(true)
  })

  it('knows the seven statuses the app renders', () => {
    expect(projectStatusSchema.options).toEqual([
      'draft',
      'active',
      'delivered',
      'invoiced',
      'paid',
      'cancelled',
      'archived'
    ])
    expect(projectSchema.safeParse({ ...base, ...fields, status: 'sent' }).success).toBe(false)
  })

  it('keeps the price in whole, non-negative cents', () => {
    expect(projectSchema.safeParse({ ...base, ...fields, priceCents: 6500.5 }).success).toBe(false)
    expect(projectSchema.safeParse({ ...base, ...fields, priceCents: -1 }).success).toBe(false)
  })
})

describe('milestone', () => {
  const fields = {
    projectId: OTHER,
    name: 'Phase one',
    description: '',
    amountCents: null,
    dueAt: null,
    deliveredAt: null,
    sortOrder: 1
  }

  it('parses with or without its own amount', () => {
    expect(milestoneSchema.safeParse({ ...base, ...fields }).success).toBe(true)
    expect(createMilestoneInputSchema.safeParse({ id: ID, ...fields, amountCents: 250000 }).success).toBe(true)
    expect(milestoneSchema.safeParse({ ...base, ...fields, amountCents: -1 }).success).toBe(false)
  })
})

describe('checklist item', () => {
  const fields = {
    projectId: OTHER,
    label: 'Brand guidelines PDF',
    done: false,
    addedAfterKickoff: true,
    sortOrder: 1.5
  }

  it('parses, with a fractional sort order', () => {
    expect(checklistItemSchema.safeParse({ ...base, ...fields }).success).toBe(true)
    expect(createChecklistItemInputSchema.safeParse({ id: ID, ...fields }).success).toBe(true)
  })

  it('refuses a blank label and a non-finite order', () => {
    expect(checklistItemSchema.safeParse({ ...base, ...fields, label: ' ' }).success).toBe(false)
    expect(checklistItemSchema.safeParse({ ...base, ...fields, sortOrder: Infinity }).success).toBe(false)
  })
})

describe('note', () => {
  const body = 'Prefers a single invoice at delivery.'

  it('belongs to exactly one project or client', () => {
    expect(noteSchema.safeParse({ ...base, projectId: OTHER, clientId: null, body, pinned: false }).success).toBe(true)
    expect(noteSchema.safeParse({ ...base, projectId: null, clientId: OTHER, body, pinned: true }).success).toBe(true)
    expect(noteSchema.safeParse({ ...base, projectId: null, clientId: null, body, pinned: false }).success).toBe(false)
    expect(noteSchema.safeParse({ ...base, projectId: OTHER, clientId: OTHER, body, pinned: false }).success).toBe(false)
  })

  it('applies the same rule to a create input, and not to a partial update', () => {
    expect(createNoteInputSchema.safeParse({ id: ID, projectId: null, clientId: null, body, pinned: false }).success).toBe(false)
    expect(updateNoteInputSchema.safeParse({ pinned: true }).success).toBe(true)
  })
})

describe('time entry', () => {
  const fields = {
    projectId: OTHER,
    checklistItemId: null,
    note: 'Logo lockup refinements',
    startedAt: '2026-08-28T09:15:00.000Z',
    endedAt: '2026-08-28T12:35:00.000Z',
    source: 'timer' as const
  }

  it('parses a finished entry and a running one', () => {
    expect(timeEntrySchema.safeParse({ ...base, ...fields }).success).toBe(true)
    expect(timeEntrySchema.safeParse({ ...base, ...fields, endedAt: null }).success).toBe(true)
  })

  it('cannot end before it starts', () => {
    const backwards = { ...fields, endedAt: '2026-08-28T09:00:00.000Z' }
    expect(timeEntrySchema.safeParse({ ...base, ...backwards }).success).toBe(false)
    expect(createTimeEntryInputSchema.safeParse({ id: ID, ...backwards }).success).toBe(false)
    /* A partial may carry only one end, so it is not judged. */
    expect(updateTimeEntryInputSchema.safeParse({ endedAt: '2026-08-28T09:00:00.000Z' }).success).toBe(true)
  })

  it('only knows two sources', () => {
    expect(timeEntrySchema.safeParse({ ...base, ...fields, source: 'import' }).success).toBe(false)
  })
})

describe('invoice', () => {
  const sent = {
    clientId: OTHER,
    number: 'INV-0148',
    status: 'sent' as const,
    currency: 'USD' as const,
    issuedAt: '2026-08-24T00:00:00.000Z',
    dueAt: '2026-09-07T00:00:00.000Z',
    taxRate: 0,
    subtotalCents: 650000,
    taxCents: 0,
    totalCents: 650000,
    notes: '',
    voidedAt: null,
    voidReason: null,
    replacedByInvoiceId: null
  }

  it('parses a sent invoice, a draft and a void', () => {
    expect(invoiceSchema.safeParse({ ...base, ...sent }).success).toBe(true)
    expect(
      invoiceSchema.safeParse({ ...base, ...sent, status: 'draft', issuedAt: null, dueAt: null }).success
    ).toBe(true)
    expect(
      invoiceSchema.safeParse({
        ...base,
        ...sent,
        status: 'void',
        voidedAt: '2026-07-18T00:00:00.000Z',
        voidReason: 'Issued to the wrong client',
        replacedByInvoiceId: ID
      }).success
    ).toBe(true)
  })

  it('knows the five statuses the list renders', () => {
    expect(invoiceStatusSchema.options).toEqual(['draft', 'sent', 'partial', 'paid', 'void'])
  })

  it('refuses totals that do not add up', () => {
    const result = invoiceSchema.safeParse({ ...base, ...sent, totalCents: 650001 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['totalCents'])
  })

  it('ties the issue date to the draft state', () => {
    expect(invoiceSchema.safeParse({ ...base, ...sent, status: 'draft' }).success).toBe(false)
    expect(invoiceSchema.safeParse({ ...base, ...sent, issuedAt: null }).success).toBe(false)
  })

  it('ties voidedAt to the void state', () => {
    expect(invoiceSchema.safeParse({ ...base, ...sent, status: 'void' }).success).toBe(false)
    expect(invoiceSchema.safeParse({ ...base, ...sent, voidedAt: AT }).success).toBe(false)
  })

  it('keeps the tax rate a per cent', () => {
    expect(invoiceSchema.safeParse({ ...base, ...sent, taxRate: 8.5 }).success).toBe(true)
    expect(invoiceSchema.safeParse({ ...base, ...sent, taxRate: 101 }).success).toBe(false)
    expect(invoiceSchema.safeParse({ ...base, ...sent, taxRate: -1 }).success).toBe(false)
  })

  it('checks a create input the same way and leaves an update alone', () => {
    expect(createInvoiceInputSchema.safeParse({ id: ID, ...sent, totalCents: 1 }).success).toBe(false)
    expect(updateInvoiceInputSchema.safeParse({ notes: 'Bank details as before.' }).success).toBe(true)
  })

  it('lines snapshot their label and amount and may point at nothing', () => {
    const line = { id: ID, invoiceId: OTHER, projectId: null, milestoneId: null, label: 'Logo lockups', amountCents: 240000, sortOrder: 1 }
    expect(createInvoiceLineInputSchema.safeParse(line).success).toBe(true)
    expect(createInvoiceLineInputSchema.safeParse({ ...line, projectId: OTHER }).success).toBe(true)
    expect(createInvoiceLineInputSchema.safeParse({ ...line, label: '' }).success).toBe(false)
    expect(createInvoiceLineInputSchema.safeParse({ ...line, amountCents: 12.5 }).success).toBe(false)
  })
})

describe('payment', () => {
  const fields = {
    invoiceId: OTHER,
    paidAt: '2026-08-24T00:00:00.000Z',
    amountCents: 221000,
    method: 'bank_transfer' as const,
    note: 'First instalment'
  }

  it('parses, and refuses a zero or fractional amount', () => {
    expect(paymentSchema.safeParse({ ...base, ...fields }).success).toBe(true)
    expect(createPaymentInputSchema.safeParse({ id: ID, ...fields, note: null }).success).toBe(true)
    expect(paymentSchema.safeParse({ ...base, ...fields, amountCents: 0 }).success).toBe(false)
    expect(paymentSchema.safeParse({ ...base, ...fields, amountCents: 10.5 }).success).toBe(false)
  })

  it('has a label for every method the dialog lists', () => {
    for (const method of paymentMethodSchema.options) {
      expect(paymentMethodLabels[method]).toBeTruthy()
    }
    expect(paymentMethodLabels.bank_transfer).toBe('Bank transfer')
  })
})

describe('settings', () => {
  const settings = {
    person: 'Alex Marchetti',
    businessName: 'Trackit Studio',
    address: '2130 Fillmore Street, Studio 4\nSan Francisco, CA 94115',
    email: 'billing@trackit.studio',
    phone: '+1 (415) 555-0134',
    logo: null,
    currency: 'USD' as const,
    taxRate: 8.5,
    paymentTermsDays: 14,
    numberingScheme: 'INV-0000',
    rateFloorCents: 10000,
    shortcut: 'CommandOrControl+Shift+S',
    theme: 'system' as const,
    accountEmail: 'alex@trackit.studio',
    updatedAt: AT,
    syncState: 'synced' as const
  }

  it('parses the shape the Settings screen reads back into', () => {
    expect(settingsSchema.parse(settings)).toEqual(settings)
  })

  it('needs a counter in the numbering scheme', () => {
    expect(settingsSchema.safeParse({ ...settings, numberingScheme: 'INV-{YYYY}' }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...settings, numberingScheme: '{YY}{MM}-000' }).success).toBe(true)
  })

  it('keeps the rate floor in whole cents and the theme to three spellings', () => {
    expect(settingsSchema.safeParse({ ...settings, rateFloorCents: 100.5 }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...settings, theme: 'auto' }).success).toBe(false)
  })

  it('update is a partial without the store columns', () => {
    expect(updateSettingsInputSchema.parse({ rateFloorCents: 12000 })).toEqual({ rateFloorCents: 12000 })
    expect(Object.keys(updateSettingsInputSchema.shape)).not.toContain('updatedAt')
  })
})

describe('startTimerInputSchema', () => {
  it('needs only a project: the note and deliverable default', () => {
    const parsed = startTimerInputSchema.parse({
      id: '9c1b1c1e-2a3b-4c4d-8e5f-6a7b8c9d0e1f',
      projectId: '1c1b1c1e-2a3b-4c4d-8e5f-6a7b8c9d0e1f'
    })
    expect(parsed.checklistItemId).toBeNull()
    expect(parsed.note).toBe('')
  })
})

describe('pendingCountsSchema', () => {
  it('accepts a partial record of the five kinds', () => {
    expect(pendingCountsSchema.parse({ time: 4, invoices: 2 })).toEqual({ time: 4, invoices: 2 })
    expect(pendingCountsSchema.safeParse({ tasks: 1 }).success).toBe(false)
  })
})

describe('auth', () => {
  it('lower-cases and trims the email so one address has one spelling', () => {
    expect(loginInputSchema.parse({ email: '  Priya@Example.COM ', password: 'x' })).toEqual({
      email: 'priya@example.com',
      password: 'x'
    })
    expect(loginInputSchema.safeParse({ email: 'admin', password: 'admin' }).success).toBe(false)
  })

  it('holds sign-up to the stated minimum and sign-in to none', () => {
    const short = 'a'.repeat(PASSWORD_MIN_LENGTH - 1)
    expect(registerInputSchema.safeParse({ name: 'Alex', email: 'a@b.co', password: short }).success).toBe(false)
    expect(registerInputSchema.safeParse({ name: 'Alex', email: 'a@b.co', password: short + 'a' }).success).toBe(true)
    expect(registerInputSchema.safeParse({ name: ' ', email: 'a@b.co', password: 'longenough' }).success).toBe(false)
    expect(loginInputSchema.safeParse({ email: 'a@b.co', password: short }).success).toBe(true)
  })

  it('reads a status as signed out, or signed in with a session state', () => {
    const user = { id: ID, email: 'a@b.co', name: 'Alex', createdAt: AT }
    expect(authStatusSchema.safeParse({ state: 'signedOut' }).success).toBe(true)
    expect(authStatusSchema.safeParse({ state: 'signedIn', user, session: 'expired' }).success).toBe(true)
    expect(authStatusSchema.safeParse({ state: 'signedIn', user }).success).toBe(false)
    expect(authStatusSchema.safeParse({ state: 'signedIn', user: { ...user, passwordHash: 'x' }, session: 'active' }).success).toBe(true)
    /* Never the hash: the parsed value drops anything the schema does not name. */
    expect(authUserSchema.parse({ ...user, passwordHash: 'x' })).toEqual(user)
  })
})
