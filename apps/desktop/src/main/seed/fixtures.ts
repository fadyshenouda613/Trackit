/*
 * The fixture data the renderer's screens are drawn against, as one dataset.
 *
 * Every figure here is lifted from a renderer fixture — ClientsTable,
 * AllProjectsTable, ProjectChecklist, ProjectDetail, ClientDetail, time-data,
 * invoices-data, invoice-data, settings-data — so that the app, once its
 * screens read from the database, looks the way the artboards do. Where two
 * of those files disagree (they were drawn one screen at a time) the choice
 * is noted beside the row.
 *
 * Keys are stable names; the seed turns them into ids deterministically, so
 * reseeding produces the same ids and a reference written down once stays
 * good.
 */
import type {
  CurrencyCode,
  InvoiceStatus,
  PaymentMethod,
  ProjectStatus,
  UpdateSettingsInput
} from '@trackit/shared/schemas'

/** The app's fixed day, from time-data.ts: a Friday. */
export const TODAY = '2026-08-28'

/** A calendar day as a stored timestamp. Fixture dates have no time of their own. */
export const at = (date: string, time = '09:00'): string => `${date}T${time}:00.000Z`

export type ClientFixture = {
  key: string
  name: string
  company: string
  email: string
  phone: string
  address: string
  currency: CurrencyCode
  paymentTermsDays: number
  createdAt: string
}

export const clients: ClientFixture[] = [
  {
    key: 'sable',
    name: 'Tom Sable',
    company: 'Sable Studio',
    email: 'tom@sablestudio.com',
    phone: '',
    address: '1180 Valencia Street\nSan Francisco, CA 94110',
    currency: 'USD',
    paymentTermsDays: 30,
    createdAt: at('2024-02-20')
  },
  {
    key: 'northwind',
    name: 'Priya Raghunathan',
    company: 'Northwind Studio',
    email: 'priya@northwindstudio.com',
    phone: '+1 415 555 0182',
    address: '418 Turk Street\nSan Francisco, CA 94102',
    currency: 'USD',
    paymentTermsDays: 14,
    createdAt: at('2024-03-04')
  },
  {
    key: 'kestrel',
    name: 'Ana Kestrel',
    company: 'Kestrel Press',
    email: 'ana@kestrelpress.com',
    phone: '',
    address: '64 Cowcross Street\nLondon EC1M 6BP',
    currency: 'USD',
    paymentTermsDays: 30,
    createdAt: at('2024-06-11')
  },
  {
    key: 'ortega',
    name: 'Elena Ortega',
    company: 'Ortega & Co',
    email: 'elena@ortegaandco.com',
    phone: '',
    address: 'Carrer de Girona 88, 3r\n08009 Barcelona',
    currency: 'USD',
    paymentTermsDays: 7,
    createdAt: at('2024-09-02')
  },
  {
    key: 'halcyon',
    name: 'Devi Halcyon',
    company: 'Halcyon Labs',
    email: 'devi@halcyonlabs.com',
    phone: '',
    address: '920 Harrison Street, Floor 2\nSan Francisco, CA 94107',
    currency: 'USD',
    paymentTermsDays: 0,
    createdAt: at('2025-01-15')
  },
  {
    key: 'marlow',
    name: 'Marcus Lidell',
    company: 'Marlow Foods',
    email: 'marcus@marlowfoods.com',
    phone: '',
    address: '77 Kingsland Road\nPortland, OR 97209',
    currency: 'USD',
    paymentTermsDays: 14,
    createdAt: at('2025-02-03')
  },
  {
    key: 'brandt',
    name: 'Jonas Brandt',
    company: 'Brandt & Vale',
    email: 'jonas@brandtvale.com',
    phone: '',
    address: '1400 Locust Street, Suite 900\nPhiladelphia, PA 19102',
    currency: 'USD',
    paymentTermsDays: 30,
    createdAt: at('2025-04-22')
  },
  {
    key: 'meridian',
    name: 'Clare Nkemelu',
    company: 'Meridian Coffee',
    email: 'clare@meridiancoffee.com',
    phone: '',
    address: '308 Divisadero Street\nSan Francisco, CA 94117',
    currency: 'USD',
    paymentTermsDays: 14,
    createdAt: at('2025-06-30')
  }
]

export type ChecklistFixture = { key: string; label: string; done: boolean; addedLater?: boolean }

export type ProjectFixture = {
  key: string
  client: string
  name: string
  description: string
  priceCents: number
  /** Chosen so that logged hours over budget gives the percentage the table shows. */
  budgetedHours: number
  status: ProjectStatus
  createdAt: string
  kickoffAt: string | null
  dueAt: string | null
  deliveredAt: string | null
  /** Either the list itself or how many of how many are done. */
  checklist: ChecklistFixture[] | { done: number; total: number }
  /** The Hours column. Sessions are generated to add up to it. */
  loggedMinutes: number
}

/** Brand refresh's list, from ProjectChecklist.tsx, in its drawn order. */
const brandRefreshChecklist: ChecklistFixture[] = [
  { key: 'kickoff', label: 'Kickoff call and brief sign-off', done: true },
  { key: 'interviews', label: 'Stakeholder interviews — four sessions', done: true },
  { key: 'audit', label: 'Competitive audit', done: true },
  { key: 'moodboards', label: 'Moodboards — three directions', done: true },
  { key: 'review', label: 'Direction review with Priya', done: true },
  { key: 'primary', label: 'Primary logo lockup', done: true },
  { key: 'horizontal', label: 'Horizontal logo lockup', done: true },
  { key: 'palette', label: 'Colour palette and type pairing', done: true },
  { key: 'secondary', label: 'Secondary marks for social', done: false, addedLater: true },
  { key: 'stationery', label: 'Business card and letterhead', done: false },
  { key: 'guidelines', label: 'Brand guidelines PDF', done: false },
  { key: 'avatars', label: 'Social avatar set — six platforms', done: false, addedLater: true },
  { key: 'signature', label: 'Email signature template', done: false, addedLater: true },
  { key: 'handover', label: 'Handover call and file package', done: false, addedLater: true }
]

const minutes = (hours: number, mins: number): number => hours * 60 + mins

/*
 * The thirteen rows of AllProjectsTable, then the two Northwind projects other
 * screens name (Signage artwork on the Create invoice screen, Packaging
 * refresh 2025 on the client detail), then one archived project per
 * invoiced piece of work the register bills that no table lists — so every
 * invoice line can point at the project it was for.
 */
export const projects: ProjectFixture[] = [
  {
    key: 'brand-refresh',
    client: 'northwind',
    name: 'Brand refresh',
    description:
      'A full identity refresh for Northwind Studio: primary and horizontal lockups, a colour palette, a type pairing, and the stationery and guidelines needed to hand it over. Two rounds of revisions are included.',
    priceCents: 650000,
    budgetedHours: 32,
    status: 'active',
    createdAt: at('2026-08-08'),
    kickoffAt: at('2026-08-12'),
    dueAt: at('2026-09-11'),
    deliveredAt: null,
    checklist: brandRefreshChecklist,
    loggedMinutes: minutes(28, 15)
  },
  {
    key: 'site-build',
    client: 'sable',
    name: 'Site build',
    description: 'Component library, nine page templates, auth and account screens, and a responsive pass.',
    priceCents: 900000,
    budgetedHours: 80,
    status: 'active',
    createdAt: at('2026-06-10'),
    kickoffAt: at('2026-06-15'),
    dueAt: at('2026-09-30'),
    deliveredAt: null,
    checklist: { done: 11, total: 12 },
    loggedMinutes: minutes(112, 40)
  },
  {
    key: 'report-design',
    client: 'ortega',
    name: 'Report design',
    description: 'Chart styling and layout for the annual report, section by section.',
    priceCents: 45000,
    budgetedHours: 6,
    status: 'active',
    createdAt: at('2026-08-07'),
    kickoffAt: at('2026-08-10'),
    dueAt: at('2026-09-05'),
    deliveredAt: null,
    checklist: { done: 3, total: 6 },
    loggedMinutes: minutes(9, 5)
  },
  {
    key: 'packaging-system',
    client: 'marlow',
    name: 'Packaging system',
    description: 'A packaging system across the range: dielines, artwork templates and a print specification.',
    priceCents: 1200000,
    budgetedHours: 110,
    status: 'active',
    createdAt: at('2026-07-28'),
    kickoffAt: at('2026-08-03'),
    dueAt: at('2026-10-30'),
    deliveredAt: null,
    checklist: { done: 4, total: 16 },
    loggedMinutes: minutes(41, 30)
  },
  {
    key: 'editorial-templates',
    client: 'kestrel',
    name: 'Editorial templates',
    description: 'Master pages, style sheets and a type scale for the imprint, with handover documentation.',
    priceCents: 320000,
    budgetedHours: 30,
    status: 'active',
    createdAt: at('2026-07-15'),
    kickoffAt: at('2026-07-20'),
    dueAt: at('2026-09-04'),
    deliveredAt: null,
    checklist: { done: 9, total: 10 },
    loggedMinutes: minutes(27, 50)
  },
  {
    key: 'onboarding-emails',
    client: 'halcyon',
    name: 'Onboarding emails',
    description: 'The welcome sequence: copy edit and template adjustments across the set.',
    priceCents: 180000,
    budgetedHours: 20,
    status: 'active',
    createdAt: at('2026-08-01'),
    kickoffAt: at('2026-08-05'),
    dueAt: at('2026-09-12'),
    deliveredAt: null,
    checklist: { done: 5, total: 8 },
    loggedMinutes: minutes(16, 20)
  },
  {
    key: 'trade-show-panels',
    client: 'northwind',
    name: 'Trade show panels',
    description: 'A six-panel system for the autumn show, with large-format artwork prepared for print.',
    priceCents: 340000,
    budgetedHours: 25,
    status: 'delivered',
    createdAt: at('2026-07-28'),
    kickoffAt: at('2026-08-01'),
    dueAt: at('2026-08-28'),
    deliveredAt: at('2026-08-26'),
    checklist: { done: 7, total: 7 },
    loggedMinutes: minutes(19, 30)
  },
  {
    key: 'annual-report-layout',
    client: 'brandt',
    name: 'Annual report layout',
    description: 'Editorial grid, master pages and 48 pages of section layouts, delivered print-ready.',
    priceCents: 540000,
    budgetedHours: 45,
    status: 'delivered',
    createdAt: at('2026-07-10'),
    kickoffAt: at('2026-07-14'),
    dueAt: at('2026-08-21'),
    deliveredAt: at('2026-08-19'),
    checklist: { done: 9, total: 9 },
    loggedMinutes: minutes(44, 15)
  },
  {
    /* The Projects table says invoiced; the register's INV-0146 is paid in
       full. The table is the screen a project's status is read from, so it wins. */
    key: 'menu-system',
    client: 'meridian',
    name: 'Menu system',
    description: 'Menu grid and typesetting, seasonal insert templates and a print specification.',
    priceCents: 275000,
    budgetedHours: 25,
    status: 'invoiced',
    createdAt: at('2026-07-17'),
    kickoffAt: at('2026-07-21'),
    dueAt: at('2026-08-14'),
    deliveredAt: at('2026-08-11'),
    checklist: { done: 6, total: 6 },
    loggedMinutes: minutes(21, 45)
  },
  {
    key: 'site-copy-refresh',
    client: 'northwind',
    name: 'Site copy refresh',
    description: 'Homepage, about and six product pages rewritten.',
    priceCents: 240000,
    budgetedHours: 20,
    status: 'paid',
    createdAt: at('2026-06-05'),
    kickoffAt: at('2026-06-10'),
    dueAt: at('2026-06-30'),
    deliveredAt: at('2026-06-28'),
    checklist: { done: 5, total: 5 },
    loggedMinutes: minutes(14, 5)
  },
  {
    key: 'wholesale-one-pager',
    client: 'marlow',
    name: 'Wholesale one-pager',
    description: 'A one-page wholesale sheet, laid out and prepared for print.',
    priceCents: 90000,
    budgetedHours: 10,
    status: 'paid',
    createdAt: at('2026-05-22'),
    kickoffAt: at('2026-05-26'),
    dueAt: at('2026-06-05'),
    deliveredAt: at('2026-06-02'),
    checklist: { done: 4, total: 4 },
    loggedMinutes: minutes(6, 10)
  },
  {
    key: 'rebrand-phase-2',
    client: 'kestrel',
    name: 'Rebrand phase 2',
    description: 'The second phase of the rebrand: applications across print and digital.',
    priceCents: 750000,
    budgetedHours: 60,
    status: 'draft',
    createdAt: at('2026-08-20'),
    kickoffAt: null,
    dueAt: null,
    deliveredAt: null,
    checklist: { done: 0, total: 11 },
    loggedMinutes: 0
  },
  {
    key: 'loyalty-card-set',
    client: 'meridian',
    name: 'Loyalty card set',
    description: 'A stamp card and the counter signage to go with it.',
    priceCents: 120000,
    budgetedHours: 12,
    status: 'cancelled',
    createdAt: at('2026-07-01'),
    kickoffAt: at('2026-07-06'),
    dueAt: at('2026-08-07'),
    deliveredAt: null,
    checklist: { done: 2, total: 5 },
    loggedMinutes: minutes(3, 40)
  },
  {
    key: 'signage-artwork',
    client: 'northwind',
    name: 'Signage artwork',
    description: 'A wayfinding sign family, fascia and window vinyl artwork, and production files.',
    priceCents: 585000,
    budgetedHours: 40,
    status: 'delivered',
    createdAt: at('2026-07-24'),
    kickoffAt: at('2026-07-28'),
    dueAt: at('2026-08-24'),
    deliveredAt: at('2026-08-21'),
    checklist: { done: 8, total: 8 },
    loggedMinutes: minutes(33, 10)
  },
  {
    key: 'packaging-refresh-2025',
    client: 'northwind',
    name: 'Packaging refresh 2025',
    description: 'Structural dielines, six carton artworks, repro and press check.',
    priceCents: 980000,
    budgetedHours: 70,
    status: 'archived',
    createdAt: at('2026-03-16'),
    kickoffAt: at('2026-03-20'),
    dueAt: at('2026-05-15'),
    deliveredAt: at('2026-05-08'),
    checklist: { done: 6, total: 6 },
    loggedMinutes: minutes(62, 20)
  },
  {
    key: 'identity-refresh',
    client: 'northwind',
    name: 'Identity refresh',
    description: 'Wordmark refinement, a stationery set and a digital asset pack.',
    priceCents: 600000,
    budgetedHours: 40,
    status: 'archived',
    createdAt: at('2026-02-02'),
    kickoffAt: at('2026-02-05'),
    dueAt: at('2026-03-06'),
    deliveredAt: at('2026-02-27'),
    checklist: { done: 5, total: 5 },
    loggedMinutes: minutes(39, 40)
  },
  {
    key: 'investor-deck',
    client: 'brandt',
    name: 'Investor deck',
    description: 'Slide master, chart system and twelve slides laid out.',
    priceCents: 290000,
    budgetedHours: 20,
    status: 'archived',
    createdAt: at('2026-07-06'),
    kickoffAt: at('2026-07-08'),
    dueAt: at('2026-07-31'),
    deliveredAt: at('2026-07-28'),
    checklist: { done: 4, total: 4 },
    loggedMinutes: minutes(18, 40)
  },
  {
    key: 'label-revisions',
    client: 'marlow',
    name: 'Label revisions',
    description: 'Nutrition panel redraw, four SKU label updates, repro and print check.',
    priceCents: 169000,
    budgetedHours: 12,
    status: 'archived',
    createdAt: at('2026-07-13'),
    kickoffAt: at('2026-07-15'),
    dueAt: at('2026-07-31'),
    deliveredAt: at('2026-07-27'),
    checklist: { done: 3, total: 3 },
    loggedMinutes: minutes(10, 40)
  },
  {
    /* Billed on INV-0142, which is still open, so invoiced rather than archived. */
    key: 'quarterly-deck-refresh',
    client: 'ortega',
    name: 'Quarterly deck refresh',
    description: 'Template rebuild and a data visual pass on the quarterly deck.',
    priceCents: 165000,
    budgetedHours: 12,
    status: 'invoiced',
    createdAt: at('2026-07-13'),
    kickoffAt: at('2026-07-15'),
    dueAt: at('2026-07-31'),
    deliveredAt: at('2026-07-27'),
    checklist: { done: 3, total: 3 },
    loggedMinutes: minutes(11, 40)
  },
  {
    key: 'launch-email-set',
    client: 'halcyon',
    name: 'Launch email set',
    description: 'Three campaign emails, tested responsive.',
    priceCents: 90000,
    budgetedHours: 8,
    status: 'archived',
    createdAt: at('2026-07-08'),
    kickoffAt: at('2026-07-10'),
    dueAt: at('2026-07-27'),
    deliveredAt: at('2026-07-23'),
    checklist: { done: 3, total: 3 },
    loggedMinutes: minutes(7, 10)
  },
  {
    key: 'brand-sheet',
    client: 'ortega',
    name: 'Brand sheet',
    description: 'A one-page brand sheet with two revision rounds.',
    priceCents: 145000,
    budgetedHours: 10,
    status: 'archived',
    createdAt: at('2026-07-06'),
    kickoffAt: at('2026-07-08'),
    dueAt: at('2026-07-20'),
    deliveredAt: at('2026-07-16'),
    checklist: { done: 2, total: 2 },
    loggedMinutes: minutes(9, 20)
  }
]

export type NoteFixture = {
  key: string
  project?: string
  client?: string
  date: string
  body: string
}

export const notes: NoteFixture[] = [
  {
    key: 'brand-refresh-1',
    project: 'brand-refresh',
    date: '2026-08-27',
    body: 'Priya asked for social avatars and an email signature on top of the agreed brief. Both are on the checklist, marked added later — raise at the delivery call rather than mid-stream.'
  },
  {
    key: 'brand-refresh-2',
    project: 'brand-refresh',
    date: '2026-08-12',
    body: 'Brief signed off on the call. Two rounds of revisions included; anything past that is quoted separately.'
  },
  {
    key: 'northwind-1',
    client: 'northwind',
    date: '2026-08-21',
    body: 'Prefers a single invoice at delivery rather than a deposit. Approvals go through Priya only — do not route work to the marketing team.'
  },
  {
    key: 'northwind-2',
    client: 'northwind',
    date: '2026-06-04',
    body: 'Paid every invoice within 6 days in 2026. Safe to keep Net 14 and skip deposits.'
  }
]

export type TimeEntryFixture = {
  key: string
  date: string
  project: string
  note: string
  /** Minutes since midnight, as time-data.ts holds them. */
  startMin: number
  endMin: number
}

const entry = (
  key: string,
  date: string,
  project: string,
  note: string,
  startMin: number,
  endMin: number
): TimeEntryFixture => ({ key, date, project, note, startMin, endMin })

/*
 * The two weeks the Time screen shows, from time-data.ts. The week before
 * them is left empty on purpose, as that screen has it; sessions generated
 * to make up each project's hours are placed before it.
 */
export const timeEntries: TimeEntryFixture[] = [
  entry('e1', '2026-08-24', 'site-build', 'Nav and footer build', 570, 765),
  entry('e2', '2026-08-24', 'onboarding-emails', 'Sequence copy', 820, 900),
  entry('e3', '2026-08-24', 'brand-refresh', 'Kickoff call and notes', 915, 995),
  entry('e4', '2026-08-25', 'packaging-system', 'Dieline revisions', 600, 795),
  entry('e5', '2026-08-25', 'site-build', 'Component audit', 840, 980),
  entry('e6', '2026-08-25', 'brand-refresh', 'Competitor sweep', 990, 1085),
  entry('e7', '2026-08-27', 'report-design', 'Chart styling for section 3', 530, 730),
  entry('e8', '2026-08-27', 'brand-refresh', 'Type scale exploration', 810, 975),
  entry('e9', '2026-08-28', 'brand-refresh', 'Logo lockup refinements', 555, 700),
  entry('e10', '2026-08-28', 'brand-refresh', 'Colour system pass', 785, 930),
  entry('e11', '2026-08-28', 'editorial-templates', 'Grid spec review', 945, 1020),
  entry('p1', '2026-08-17', 'site-build', 'Sprint planning', 840, 940),
  entry('p2', '2026-08-18', 'editorial-templates', 'Master pages', 545, 750),
  entry('p3', '2026-08-18', 'brand-refresh', 'Stakeholder review', 840, 925),
  entry('p4', '2026-08-19', 'site-build', 'Auth screens', 580, 775),
  entry('p5', '2026-08-19', 'onboarding-emails', 'Welcome sequence', 830, 920),
  entry('p6', '2026-08-20', 'brand-refresh', 'Moodboard round two', 610, 780),
  entry('p7', '2026-08-20', 'packaging-system', 'Print spec call', 855, 945),
  entry('p8', '2026-08-21', 'site-build', 'Responsive pass', 540, 730),
  entry('p9', '2026-08-21', 'report-design', 'Data table spec', 795, 935)
]

/**
 * The last day generated sessions may fall on: the Friday before the empty
 * week that precedes the two seeded ones. A project that kicked off inside
 * that empty week has nowhere else to put its hours, so it fills forward
 * from its kickoff instead — Brand refresh and Report design are the two.
 */
export const FILLER_UNTIL = '2026-08-07'

/** The Monday the seeded weeks begin; forward-filled sessions stop before it. */
export const SEEDED_WEEKS_FROM = '2026-08-17'

export type PaymentFixture = {
  key: string
  date: string
  amountCents: number
  method: PaymentMethod
  note: string | null
}

export type LineGroupFixture = {
  project: string
  lines: [label: string, amountCents: number][]
}

export type InvoiceFixture = {
  number: string
  client: string
  /** Null on the draft. */
  issued: string | null
  taxRate: number
  groups: LineGroupFixture[]
  payments: PaymentFixture[]
  notes: string
  voided?: { date: string; reason: string; replacedBy?: string }
  /** Raised while the server could not be reached: the number is the local scheme's guess. */
  provisional?: boolean
}

const dollars = (amount: number): number => amount * 100

const group = (project: string, lines: [string, number][]): LineGroupFixture => ({
  project,
  lines: lines.map(([label, amount]) => [label, dollars(amount)])
})

const paid = (
  key: string,
  date: string,
  amount: number,
  method: PaymentMethod,
  note: string | null = null
): PaymentFixture => ({ key, date, amountCents: dollars(amount), method, note })

/*
 * The register, newest first, from invoices-data.ts. Each line group names
 * the project it was for; the historical ones are the archived projects
 * above. INV-0149 is the draft, raised offline so its number is still
 * provisional; INV-0137 is the void, reissued as INV-0138.
 */
export const invoices: InvoiceFixture[] = [
  {
    number: 'INV-0149',
    client: 'brandt',
    issued: null,
    provisional: true,
    taxRate: 0,
    groups: [
      group('annual-report-layout', [
        ['Editorial grid and master pages', 2200],
        ['Section layouts, 48 pages', 2400],
        ['Print-ready artwork', 800]
      ])
    ],
    payments: [],
    notes: ''
  },
  {
    number: 'INV-0148',
    client: 'northwind',
    issued: '2026-08-24',
    taxRate: 0,
    groups: [
      group('brand-refresh', [
        ['Logo lockups', 2400],
        ['Type system and scale', 1600],
        ['Colour system', 1300],
        ['Brand guidelines', 1200]
      ])
    ],
    payments: [],
    notes: 'Bank details as before. Two revision rounds included, as agreed at kickoff.'
  },
  {
    number: 'INV-0147',
    client: 'kestrel',
    issued: '2026-08-20',
    taxRate: 0,
    groups: [
      group('editorial-templates', [
        ['Master page set', 1400],
        ['Style sheets and type scale', 1000],
        ['Handover documentation', 800]
      ])
    ],
    payments: [paid('p-0147-1', '2026-08-24', 2210, 'bank_transfer', 'First instalment')],
    notes: ''
  },
  {
    number: 'INV-0146',
    client: 'meridian',
    issued: '2026-08-12',
    taxRate: 0,
    groups: [
      group('menu-system', [
        ['Menu grid and typesetting', 1500],
        ['Seasonal insert templates', 750],
        ['Print specification', 500]
      ])
    ],
    payments: [paid('p-0146-1', '2026-08-21', 2750, 'bank_transfer')],
    notes: ''
  },
  {
    number: 'INV-0145',
    client: 'sable',
    issued: '2026-08-12',
    taxRate: 0,
    groups: [
      group('site-build', [
        ['Component library', 3200],
        ['Page templates, nine screens', 3000],
        ['Auth and account screens', 1800],
        ['Responsive pass', 1000]
      ])
    ],
    payments: [
      paid('p-0145-1', '2026-08-14', 5000, 'bank_transfer', 'Deposit'),
      paid('p-0145-2', '2026-08-21', 3000, 'bank_transfer')
    ],
    notes: 'Balance due on sign-off of the responsive pass.'
  },
  {
    number: 'INV-0144',
    client: 'brandt',
    issued: '2026-07-30',
    taxRate: 0,
    groups: [
      group('investor-deck', [
        ['Slide master and grid', 1200],
        ['Chart system', 900],
        ['Twelve slides laid out', 800]
      ])
    ],
    payments: [paid('p-0144-1', '2026-08-13', 2900, 'bank_transfer')],
    notes: ''
  },
  {
    number: 'INV-0143',
    client: 'marlow',
    issued: '2026-07-29',
    taxRate: 0,
    groups: [
      group('label-revisions', [
        ['Nutrition panel redraw', 740],
        ['Four SKU label updates', 620],
        ['Repro and print check', 330]
      ])
    ],
    payments: [paid('p-0143-1', '2026-08-05', 1690, 'card')],
    notes: ''
  },
  {
    number: 'INV-0142',
    client: 'ortega',
    issued: '2026-07-28',
    taxRate: 0,
    groups: [
      group('report-design', [['Chart styling, section 3', 450]]),
      group('quarterly-deck-refresh', [
        ['Template rebuild', 950],
        ['Data visual pass', 700]
      ])
    ],
    payments: [],
    notes: 'Second reminder sent 18 Aug.'
  },
  {
    number: 'INV-0141',
    client: 'halcyon',
    issued: '2026-07-24',
    taxRate: 0,
    groups: [
      group('launch-email-set', [
        ['Three campaign emails', 600],
        ['Responsive testing', 300]
      ])
    ],
    payments: [paid('p-0141-1', '2026-08-07', 900, 'paypal')],
    notes: ''
  },
  {
    number: 'INV-0139',
    client: 'halcyon',
    issued: '2026-08-22',
    taxRate: 0,
    groups: [
      group('onboarding-emails', [
        ['Welcome sequence copy edit', 520],
        ['Template adjustments', 340]
      ])
    ],
    payments: [],
    notes: 'Due on receipt.'
  },
  {
    number: 'INV-0138',
    client: 'ortega',
    issued: '2026-07-18',
    taxRate: 0,
    groups: [
      group('brand-sheet', [
        ['One-page brand sheet', 950],
        ['Two revision rounds', 500]
      ])
    ],
    payments: [paid('p-0138-1', '2026-07-24', 1450, 'bank_transfer')],
    notes: ''
  },
  {
    number: 'INV-0137',
    client: 'kestrel',
    issued: '2026-07-15',
    taxRate: 0,
    groups: [
      group('brand-sheet', [
        ['One-page brand sheet', 950],
        ['Two revision rounds', 500]
      ])
    ],
    payments: [],
    notes: '',
    voided: { date: '2026-07-18', reason: 'Issued to the wrong client', replacedBy: 'INV-0138' }
  },
  {
    number: 'INV-0131',
    client: 'northwind',
    issued: '2026-07-02',
    taxRate: 0,
    groups: [
      group('site-copy-refresh', [
        ['Homepage and about copy', 1400],
        ['Product pages, six', 1000]
      ])
    ],
    payments: [paid('p-0131-1', '2026-07-08', 2400, 'bank_transfer')],
    notes: ''
  },
  {
    number: 'INV-0122',
    client: 'marlow',
    issued: '2026-06-05',
    taxRate: 0,
    groups: [
      group('wholesale-one-pager', [
        ['One-pager layout', 600],
        ['Print-ready artwork', 300]
      ])
    ],
    payments: [paid('p-0122-1', '2026-06-11', 900, 'cheque')],
    notes: ''
  },
  {
    number: 'INV-0119',
    client: 'northwind',
    issued: '2026-05-14',
    taxRate: 0,
    groups: [
      group('packaging-refresh-2025', [
        ['Structural dielines', 3600],
        ['Six carton artworks', 4200],
        ['Repro and press check', 2000]
      ])
    ],
    payments: [paid('p-0119-1', '2026-05-22', 9800, 'bank_transfer')],
    notes: ''
  },
  {
    /* The one invoice with tax on it: $6,000.00 at 20% is the $7,200.00 ClientDetail states. */
    number: 'INV-0104',
    client: 'northwind',
    issued: '2026-03-03',
    taxRate: 20,
    groups: [
      group('identity-refresh', [
        ['Wordmark refinement', 2600],
        ['Stationery set', 1900],
        ['Digital asset pack', 1500]
      ])
    ],
    payments: [paid('p-0104-1', '2026-03-10', 7200, 'bank_transfer')],
    notes: ''
  }
]

/** What the register's statuses come to, for the seed's own check. */
export const expectedInvoiceStatuses: Record<string, InvoiceStatus> = {
  'INV-0149': 'draft',
  'INV-0148': 'sent',
  'INV-0147': 'partial',
  'INV-0145': 'partial',
  'INV-0146': 'paid',
  'INV-0142': 'sent',
  'INV-0139': 'sent',
  'INV-0137': 'void'
}

/** settings-data.ts's defaults, with the figures parsed the way the screen parses them. */
export const settings: UpdateSettingsInput = {
  person: 'Alex Marchetti',
  businessName: 'Trackit Studio',
  address: '2130 Fillmore Street, Studio 4\nSan Francisco, CA 94115',
  email: 'billing@trackit.studio',
  phone: '+1 (415) 555-0134',
  logo: null,
  currency: 'USD',
  taxRate: 8.5,
  paymentTermsDays: 14,
  numberingScheme: 'INV-0000',
  rateFloorCents: 10000,
  shortcut: 'CommandOrControl+Shift+S',
  theme: 'system',
  accountEmail: 'alex@trackit.studio'
}
