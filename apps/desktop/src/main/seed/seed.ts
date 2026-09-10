import { createHash } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import { addDays, invoiceStatusOf, invoiceTotals, paidCents } from '@trackit/shared/helpers'
import type { Invoice, Payment, Project, TimeEntry } from '@trackit/shared/schemas'
import {
  checklistItemsTable,
  clientsTable,
  invoiceLinesTable,
  invoicesTable,
  notesTable,
  paymentsTable,
  projectsTable,
  timeEntriesTable,
  updateSettings
} from '../repositories'
import { insertRow } from '../repositories/table'
import {
  FILLER_UNTIL,
  SEEDED_WEEKS_FROM,
  at,
  clients,
  invoices,
  notes,
  projects,
  settings,
  timeEntries,
  type ProjectFixture
} from './fixtures'

/*
 * Loads the fixtures into a database.
 *
 * Rows go in through insertRow, below the repositories' rules: the fixtures
 * describe a history — a project already invoiced, an item flagged as added
 * later, a void with its replacement — and a history is written down, not
 * re-enacted. Each row is still parsed by its schema on the way in.
 */

/** A stable UUIDv4 for a fixture key, so reseeding gives the same ids. */
export function uuidFor(key: string): string {
  const bytes = createHash('sha256').update(`trackit-seed:${key}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const clientId = (key: string): string => uuidFor(`client:${key}`)
const projectId = (key: string): string => uuidFor(`project:${key}`)
const invoiceId = (number: string): string => uuidFor(`invoice:${number}`)

const DAY_MS = 86_400_000

const clockOf = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Stored columns every seeded row shares. `synced`: the fixtures are history the server already has. */
const stamps = (createdAt: string) => ({
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
  syncState: 'synced' as const
})

const isWeekday = (date: string): boolean => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day !== 0 && day !== 6
}

/**
 * Sessions that bring a project's logged time up to the figure the table
 * shows: on weekdays, working back from the delivery (or the cut-off before
 * the seeded weeks) to the kickoff. A project that kicked off past the
 * cut-off fills forward from its kickoff instead. Whatever still does not
 * fit lands as an evening session on the last day used.
 */
function fillerSessions(project: ProjectFixture, seededMinutes: number): TimeEntry[] {
  let remaining = project.loggedMinutes - seededMinutes
  if (remaining <= 0 || project.kickoffAt === null) return []

  const lengths = [420, 480, 390, 450, 360]
  const kickoff = project.kickoffAt.slice(0, 10)
  const anchorCandidate = (project.deliveredAt ?? project.dueAt ?? FILLER_UNTIL).slice(0, 10)
  const anchor = anchorCandidate < FILLER_UNTIL ? anchorCandidate : FILLER_UNTIL

  const days: string[] = []
  if (kickoff <= anchor) {
    for (let day = anchor; day >= kickoff; day = addDays(day, -1)) {
      if (isWeekday(day)) days.push(day)
    }
  } else {
    for (let day = kickoff; day < SEEDED_WEEKS_FROM; day = addDays(day, 1)) {
      if (isWeekday(day)) days.push(day)
    }
  }

  const sessions: TimeEntry[] = []
  const session = (date: string, startMin: number, minutes: number): void => {
    const startedAt = at(date, clockOf(startMin))
    sessions.push({
      id: uuidFor(`time:${project.key}:fill:${sessions.length}`),
      projectId: projectId(project.key),
      checklistItemId: null,
      note: 'Working session',
      startedAt,
      endedAt: new Date(Date.parse(startedAt) + minutes * 60_000).toISOString(),
      source: 'timer',
      ...stamps(startedAt)
    })
  }

  let last = kickoff
  for (const day of days) {
    if (remaining <= 0) break
    const minutes = Math.min(remaining, lengths[sessions.length % lengths.length])
    session(day, 9 * 60, minutes)
    remaining -= minutes
    last = day
  }
  if (remaining > 0) session(last, 18 * 60, remaining)

  return sessions
}

export type SeedSummary = Record<string, number>

export function seedDatabase(db: Database): SeedSummary {
  const summary: SeedSummary = {}
  const count = (table: string): void => {
    summary[table] = (summary[table] ?? 0) + 1
  }

  db.transaction(() => {
    updateSettings(db, settings)

    for (const client of clients) {
      insertRow(db, clientsTable, {
        id: clientId(client.key),
        name: client.name,
        company: client.company,
        email: client.email,
        phone: client.phone,
        address: client.address,
        currency: client.currency,
        paymentTermsDays: client.paymentTermsDays,
        notes: '',
        ...stamps(client.createdAt)
      })
      count('clients')
    }

    const projectByKey = new Map<string, Project>()
    for (const project of projects) {
      const row = insertRow(db, projectsTable, {
        id: projectId(project.key),
        clientId: clientId(project.client),
        name: project.name,
        description: project.description,
        priceCents: project.priceCents,
        currency: 'USD',
        budgetedHours: project.budgetedHours,
        status: project.status,
        kickoffAt: project.kickoffAt,
        dueAt: project.dueAt,
        deliveredAt: project.deliveredAt,
        ...stamps(project.createdAt)
      })
      projectByKey.set(project.key, row)
      count('projects')

      const items = Array.isArray(project.checklist)
        ? project.checklist
        : Array.from({ length: project.checklist.total }, (_, index) => ({
            key: `item-${index + 1}`,
            label: `Deliverable ${index + 1}`,
            done: index < (project.checklist as { done: number }).done
          }))
      items.forEach((item, index) => {
        const addedLater = 'addedLater' in item && item.addedLater === true
        const createdAt = addedLater ? at('2026-08-20', '14:00') : project.createdAt
        insertRow(db, checklistItemsTable, {
          id: uuidFor(`checklist:${project.key}:${item.key}`),
          projectId: row.id,
          label: item.label,
          done: item.done,
          addedAfterKickoff: addedLater,
          sortOrder: index + 1,
          ...stamps(createdAt)
        })
        count('checklist_items')
      })
    }

    for (const note of notes) {
      insertRow(db, notesTable, {
        id: uuidFor(`note:${note.key}`),
        projectId: note.project ? projectId(note.project) : null,
        clientId: note.client ? clientId(note.client) : null,
        body: note.body,
        pinned: false,
        ...stamps(at(note.date, '17:00'))
      })
      count('notes')
    }

    const seededMinutes = new Map<string, number>()
    for (const entry of timeEntries) {
      const startedAt = at(entry.date, clockOf(entry.startMin))
      insertRow(db, timeEntriesTable, {
        id: uuidFor(`time:${entry.key}`),
        projectId: projectId(entry.project),
        checklistItemId: null,
        note: entry.note,
        startedAt,
        endedAt: at(entry.date, clockOf(entry.endMin)),
        source: 'timer',
        ...stamps(startedAt)
      })
      seededMinutes.set(entry.project, (seededMinutes.get(entry.project) ?? 0) + (entry.endMin - entry.startMin))
      count('time_entries')
    }
    for (const project of projects) {
      for (const session of fillerSessions(project, seededMinutes.get(project.key) ?? 0)) {
        insertRow(db, timeEntriesTable, session)
        count('time_entries')
      }
    }

    // Newest first, as the register lists them: a void's replacement is always
    // newer than the void, so it exists before the void points at it.
    for (const fixture of invoices) {
      const client = clients.find((entry) => entry.key === fixture.client)
      if (!client) throw new Error(`Invoice ${fixture.number} names an unknown client ${fixture.client}`)

      const lines = fixture.groups.flatMap((group, groupIndex) =>
        group.lines.map(([label, amountCents], lineIndex) => ({
          id: uuidFor(`line:${fixture.number}:${group.project}:${lineIndex}`),
          invoiceId: invoiceId(fixture.number),
          projectId: projectId(group.project),
          milestoneId: null,
          label,
          amountCents,
          sortOrder: groupIndex * 100 + lineIndex + 1
        }))
      )
      const totals = invoiceTotals(lines, fixture.taxRate)
      const payments: Payment[] = fixture.payments.map((payment) => ({
        id: uuidFor(`payment:${payment.key}`),
        invoiceId: invoiceId(fixture.number),
        paidAt: at(payment.date, '12:00'),
        amountCents: payment.amountCents,
        method: payment.method,
        note: payment.note,
        ...stamps(at(payment.date, '12:00'))
      }))

      const issuedAt = fixture.issued ? at(fixture.issued) : null
      const createdAt = issuedAt ?? at('2026-08-27', '16:00')
      const status = invoiceStatusOf({
        voided: fixture.voided !== undefined,
        issued: issuedAt !== null,
        totalCents: totals.totalCents,
        paidCents: paidCents(payments)
      })

      const invoice: Invoice = {
        id: invoiceId(fixture.number),
        clientId: clientId(fixture.client),
        number: fixture.number,
        numberProvisional: fixture.provisional ?? false,
        pdfGeneratedAt: null,
        status,
        currency: client.currency,
        issuedAt,
        dueAt:
          issuedAt === null
            ? null
            : new Date(Date.parse(issuedAt) + client.paymentTermsDays * DAY_MS).toISOString(),
        taxRate: fixture.taxRate,
        ...totals,
        notes: fixture.notes,
        voidedAt: fixture.voided ? at(fixture.voided.date, '10:00') : null,
        voidReason: fixture.voided?.reason ?? null,
        replacedByInvoiceId: fixture.voided?.replacedBy ? invoiceId(fixture.voided.replacedBy) : null,
        ...stamps(createdAt)
      }
      insertRow(db, invoicesTable, invoice)
      count('invoices')

      for (const line of lines) {
        insertRow(db, invoiceLinesTable, { ...line, ...stamps(createdAt) })
        count('invoice_lines')
      }
      for (const payment of payments) {
        insertRow(db, paymentsTable, payment)
        count('payments')
      }
    }
  })()

  return summary
}
