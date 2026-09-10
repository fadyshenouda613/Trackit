/*
 * The server's tables, as Drizzle sees them.
 *
 * Two kinds. `users` and `refreshTokens` are the server's own: nobody syncs
 * them and the server mints their ids. Everything else mirrors a table in
 * the desktop's SQLite (apps/desktop/src/main/db/migrations) column for
 * column, with the SQLite types made honest for Postgres — timestamptz for
 * the ISO strings, boolean for the 0/1s, double precision for the REALs —
 * and two columns added to every one:
 *
 *   user_id     whose row this is. Every query on a syncable table is scoped
 *               by it; there is no such thing as a row without an owner.
 *   server_seq  the position of this row's latest write in one sequence
 *               shared by every table (sync_seq), so a client can ask
 *               "everything of mine after N" with one number and get a
 *               stable answer across all ten. Every write — insert or
 *               update — takes a fresh value. Indexed with user_id because
 *               that is the only way it is ever read.
 *   updated_by  the device whose write this version is. Ties on updated_at
 *               are broken by comparing it. Null for rows from before it
 *               existed.
 *
 * What is not here: `sync_state`. It says whether the *client's* copy has
 * reached the server, which is a fact about the client. The same goes for
 * the two machine-local settings, theme and account email.
 *
 * Money is integer cents. Ids on the syncable tables are the UUIDs the
 * client minted; the server never assigns one. Rows are never deleted —
 * `deleted_at` is set — and every foreign-key index is partial on live rows
 * for the same reason the SQLite ones are.
 */
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn
} from 'drizzle-orm/pg-core'
import {
  currencyCodeSchema,
  invoiceStatusSchema,
  paymentMethodSchema,
  projectStatusSchema,
  timeEntrySourceSchema
} from '@trackit/shared/schemas'

const at = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

/** The one sequence every syncable table's server_seq draws from. */
export const syncSeq = pgSequence('sync_seq')

const nextSeq = sql`nextval('sync_seq')`
const serverSeq = () => bigint('server_seq', { mode: 'number' }).notNull().default(nextSeq)

/**
 * A shared enum's members as the non-empty tuple Drizzle's `enum` option
 * wants. Zod types `.options` as a plain array; the members are the same.
 */
const choices = <T extends string>(schema: { options: readonly T[] }): [T, ...T[]] =>
  schema.options as [T, ...T[]]

/* ---- The server's own ------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    /** Lower-cased before it gets here (emailSchema), so the unique index is exact. */
    email: text('email').notNull(),
    name: text('name').notNull(),
    /** argon2id, in PHC string form. */
    passwordHash: text('password_hash').notNull(),
    createdAt: at('created_at').notNull(),
    updatedAt: at('updated_at').notNull()
  },
  (table) => [uniqueIndex('users_email').on(table.email)]
)

/**
 * A refresh token is stored only as its hash: the database never holds
 * anything that can be presented. Tokens are issued in families — one per
 * sign-in — and rotated on every refresh, so a family is a chain where each
 * link names its successor. Presenting a link that already has one is
 * reuse, and reuse revokes the whole family.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: at('expires_at').notNull(),
    createdAt: at('created_at').notNull(),
    revokedAt: at('revoked_at'),
    /** The link issued in this one's place. Self-referencing, hence the annotation. */
    replacedById: uuid('replaced_by_id').references((): AnyPgColumn => refreshTokens.id)
  },
  (table) => [
    uniqueIndex('refresh_tokens_token_hash').on(table.tokenHash),
    index('refresh_tokens_family_id').on(table.familyId),
    index('refresh_tokens_user_id').on(table.userId)
  ]
)

/* ---- Mirrors of the desktop's tables ---------------------------------------- */

/** The columns every syncable row carries here: the four base ones, the owner, the sequence, the writer. */
const syncable = () => ({
  id: uuid('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  serverSeq: serverSeq(),
  updatedBy: uuid('updated_by'),
  createdAt: at('created_at').notNull(),
  updatedAt: at('updated_at').notNull(),
  deletedAt: at('deleted_at')
})

const live = sql`deleted_at IS NULL`

export const clients = pgTable(
  'clients',
  {
    ...syncable(),
    name: text('name').notNull(),
    company: text('company').notNull().default(''),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    address: text('address').notNull().default(''),
    currency: text('currency', { enum: choices(currencyCodeSchema) }).notNull(),
    paymentTermsDays: integer('payment_terms_days').notNull().default(0),
    notes: text('notes').notNull().default('')
  },
  (table) => [index('clients_user_seq').on(table.userId, table.serverSeq)]
)

export const projects = pgTable(
  'projects',
  {
    ...syncable(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    priceCents: integer('price_cents').notNull(),
    currency: text('currency', { enum: choices(currencyCodeSchema) }).notNull(),
    budgetedHours: doublePrecision('budgeted_hours').notNull().default(0),
    status: text('status', { enum: choices(projectStatusSchema) }).notNull(),
    kickoffAt: at('kickoff_at'),
    dueAt: at('due_at'),
    deliveredAt: at('delivered_at')
  },
  (table) => [
    index('projects_user_seq').on(table.userId, table.serverSeq),
    index('projects_client_id').on(table.clientId).where(live)
  ]
)

export const milestones = pgTable(
  'milestones',
  {
    ...syncable(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    amountCents: integer('amount_cents'),
    dueAt: at('due_at'),
    deliveredAt: at('delivered_at'),
    sortOrder: doublePrecision('sort_order').notNull()
  },
  (table) => [
    index('milestones_user_seq').on(table.userId, table.serverSeq),
    index('milestones_project_id').on(table.projectId).where(live)
  ]
)

export const checklistItems = pgTable(
  'checklist_items',
  {
    ...syncable(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    label: text('label').notNull(),
    done: boolean('done').notNull().default(false),
    addedAfterKickoff: boolean('added_after_kickoff').notNull().default(false),
    sortOrder: doublePrecision('sort_order').notNull()
  },
  (table) => [
    index('checklist_items_user_seq').on(table.userId, table.serverSeq),
    index('checklist_items_project_id').on(table.projectId).where(live)
  ]
)

export const notes = pgTable(
  'notes',
  {
    ...syncable(),
    projectId: uuid('project_id').references(() => projects.id),
    clientId: uuid('client_id').references(() => clients.id),
    body: text('body').notNull(),
    pinned: boolean('pinned').notNull().default(false)
  },
  (table) => [
    /* A note belongs to exactly one thing. */
    check('notes_owned_by_one', sql`(${table.projectId} IS NULL) <> (${table.clientId} IS NULL)`),
    index('notes_user_seq').on(table.userId, table.serverSeq),
    index('notes_project_id').on(table.projectId).where(live),
    index('notes_client_id').on(table.clientId).where(live)
  ]
)

export const timeEntries = pgTable(
  'time_entries',
  {
    ...syncable(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    checklistItemId: uuid('checklist_item_id').references(() => checklistItems.id),
    note: text('note').notNull().default(''),
    startedAt: at('started_at').notNull(),
    /** Null while the timer runs. */
    endedAt: at('ended_at'),
    source: text('source', { enum: choices(timeEntrySourceSchema) }).notNull()
  },
  (table) => [
    index('time_entries_user_seq').on(table.userId, table.serverSeq),
    index('time_entries_project_id').on(table.projectId).where(live),
    index('time_entries_started_at').on(table.userId, table.startedAt).where(live)
  ]
)

export const invoices = pgTable(
  'invoices',
  {
    ...syncable(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    number: text('number').notNull(),
    status: text('status', { enum: choices(invoiceStatusSchema) }).notNull(),
    currency: text('currency', { enum: choices(currencyCodeSchema) }).notNull(),
    issuedAt: at('issued_at'),
    dueAt: at('due_at'),
    taxRate: doublePrecision('tax_rate').notNull().default(0),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    notes: text('notes').notNull().default(''),
    voidedAt: at('voided_at'),
    voidReason: text('void_reason'),
    replacedByInvoiceId: uuid('replaced_by_invoice_id').references((): AnyPgColumn => invoices.id)
  },
  (table) => [
    index('invoices_user_seq').on(table.userId, table.serverSeq),
    index('invoices_client_id').on(table.clientId).where(live)
  ]
)

export const invoiceLines = pgTable(
  'invoice_lines',
  {
    ...syncable(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    projectId: uuid('project_id').references(() => projects.id),
    milestoneId: uuid('milestone_id').references(() => milestones.id),
    label: text('label').notNull(),
    amountCents: integer('amount_cents').notNull(),
    sortOrder: doublePrecision('sort_order').notNull()
  },
  (table) => [
    index('invoice_lines_user_seq').on(table.userId, table.serverSeq),
    index('invoice_lines_invoice_id').on(table.invoiceId).where(live)
  ]
)

export const payments = pgTable(
  'payments',
  {
    ...syncable(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    paidAt: at('paid_at').notNull(),
    amountCents: integer('amount_cents').notNull(),
    method: text('method', { enum: choices(paymentMethodSchema) }).notNull(),
    note: text('note')
  },
  (table) => [
    index('payments_user_seq').on(table.userId, table.serverSeq),
    index('payments_invoice_id').on(table.invoiceId).where(live)
  ]
)

/**
 * One row per person, keyed by them, never deleted — the desktop's
 * single-row table with the user as its id. The two machine-local
 * preferences (theme, account email) stay on the machine.
 */
export const settings = pgTable(
  'settings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
    serverSeq: serverSeq(),
    updatedBy: uuid('updated_by'),
    person: text('person').notNull().default(''),
    businessName: text('business_name').notNull().default(''),
    address: text('address').notNull().default(''),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    logo: text('logo'),
    currency: text('currency', { enum: choices(currencyCodeSchema) }).notNull().default('USD'),
    taxRate: doublePrecision('tax_rate').notNull().default(0),
    paymentTermsDays: integer('payment_terms_days').notNull().default(14),
    numberingScheme: text('numbering_scheme').notNull().default('INV-0000'),
    rateFloorCents: integer('rate_floor_cents').notNull().default(0),
    shortcut: text('shortcut').notNull().default('CommandOrControl+Shift+S'),
    updatedAt: at('updated_at').notNull()
  },
  (table) => [index('settings_user_seq').on(table.userId, table.serverSeq)]
)
