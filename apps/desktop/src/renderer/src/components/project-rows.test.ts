import { describe, expect, it } from 'vitest'
import type { ChecklistItem, Client, Project, TimeEntry } from '@trackit/shared'
import { allProjectRow, projectFigures, projectTotals, type ProjectFigures } from './project-rows'

const BASE = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, syncState: 'pending' as const }

const client = (over: Partial<Client> = {}): Client => ({
  ...BASE,
  id: 'c1',
  name: 'Jane Doe',
  company: 'Acme Co',
  email: 'jane@acme.com',
  phone: '',
  address: '',
  currency: 'USD',
  paymentTermsDays: 14,
  notes: '',
  ...over
})

const project = (over: Partial<Project> = {}): Project => ({
  ...BASE,
  id: 'p1',
  clientId: 'c1',
  name: 'Project 1',
  description: '',
  priceCents: 120000,
  currency: 'USD',
  budgetedHours: 10,
  status: 'active',
  kickoffAt: '2026-01-01T00:00:00.000Z',
  dueAt: null,
  deliveredAt: null,
  ...over
})

const entry = (over: Partial<TimeEntry> = {}): TimeEntry => ({
  ...BASE,
  id: 'e1',
  projectId: 'p1',
  checklistItemId: null,
  note: '',
  startedAt: '2026-08-01T09:00:00.000Z',
  endedAt: '2026-08-01T10:00:00.000Z',
  source: 'manual',
  ...over
})

const item = (over: Partial<ChecklistItem> = {}): ChecklistItem => ({
  ...BASE,
  id: 'ci1',
  projectId: 'p1',
  label: 'Item',
  done: false,
  addedAfterKickoff: false,
  sortOrder: 1,
  ...over
})

describe('projectFigures', () => {
  it('sums logged minutes across a finished entry and a running one, and derives the rate and budget', () => {
    const p = project({ priceCents: 120000, budgetedHours: 10 })
    const finished = entry({ id: 'e1', startedAt: '2026-08-01T09:00:00.000Z', endedAt: '2026-08-01T10:00:00.000Z' })
    const running = entry({ id: 'e2', startedAt: '2026-08-01T11:00:00.000Z', endedAt: null })
    const now = '2026-08-01T11:30:00.000Z'

    const figures = projectFigures(p, [client()], [finished, running], [], now)

    // 60 minutes finished + 30 minutes running-to-now
    expect(figures.loggedMinutes).toBe(90)
    expect(figures.budgetMinutes).toBe(600)
    // effectiveRateCents(120000, 90) = round(120000 * 60 / 90)
    expect(figures.rateCents).toBe(80000)
    expect(figures.budget.percent).toBe(15)
    expect(figures.client?.id).toBe('c1')
  })

  it('has no rate for a cancelled project regardless of hours logged', () => {
    const p = project({ status: 'cancelled' })
    const figures = projectFigures(p, [], [entry()], [], '2026-08-01T12:00:00.000Z')
    expect(figures.rateCents).toBeNull()
  })

  it('carries checklist counts, including items added after kickoff', () => {
    const p = project()
    const items = [item({ id: 'i1', done: true }), item({ id: 'i2', done: false, addedAfterKickoff: true })]
    const figures = projectFigures(p, [], [], items, '2026-08-01T12:00:00.000Z')
    expect(figures.checklist).toMatchObject({ done: 1, total: 2, later: 1, open: 1 })
  })
})

function figuresFor(over: Partial<Project>, entries: TimeEntry[] = [], items: ChecklistItem[] = []): ProjectFigures {
  return projectFigures(project(over), [client()], entries, items, '2026-08-01T12:00:00.000Z')
}

describe('allProjectRow', () => {
  it('is neutral and dashless for a draft, regardless of budget or rate', () => {
    const f = figuresFor({ status: 'draft', budgetedHours: 1 }, [entry({ startedAt: '2026-08-01T09:00:00.000Z', endedAt: '2026-08-01T12:00:00.000Z' })])
    const row = allProjectRow(f, 5000, null)
    expect(row.status).toBe('draft')
    expect(row.checklistPct).toBeNull()
    expect(row.budgetPct).toBeNull()
    expect(row.budgetLabel).toBe('—')
    expect(row.budgetTone).toBe('neutral')
  })

  it('tones negative when hours logged run past the budget', () => {
    // budgetedHours: 1h = 60 minutes; log 2h = 120 minutes -> 200%, over
    const f = figuresFor({ status: 'active', budgetedHours: 1 }, [entry({ startedAt: '2026-08-01T09:00:00.000Z', endedAt: '2026-08-01T11:00:00.000Z' })])
    const row = allProjectRow(f, 5000, null)
    expect(f.budget.over).toBe(true)
    expect(row.budgetTone).toBe('negative')
    expect(row.budgetLabelTone).toBe('negative')
  })

  it('tones the rate negative when it falls below the floor', () => {
    // priceCents 120000 / 90 minutes logged -> 80000 cents/hr, well above a low floor;
    // use a high floor to force "below floor".
    const f = figuresFor(
      { status: 'active', priceCents: 12000 },
      [entry({ startedAt: '2026-08-01T09:00:00.000Z', endedAt: '2026-08-01T10:00:00.000Z' })]
    )
    // effectiveRateCents(12000, 60) = 12000 -> below a 50000 floor
    const row = allProjectRow(f, 50000, null)
    expect(f.rateCents).toBe(12000)
    expect(row.rateTone).toBe('negative')
  })

  it('marks the running project', () => {
    const f = figuresFor({ status: 'active' })
    const row = allProjectRow(f, 5000, f.project.id)
    expect(row.running).toBe(true)
  })
})

describe('projectTotals', () => {
  it('excludes draft and cancelled projects from count, price, hours and the blended rate', () => {
    const draft = figuresFor({ id: 'p-draft', status: 'draft', priceCents: 999999 })
    const cancelled = figuresFor({ id: 'p-cancelled', status: 'cancelled', priceCents: 999999 })
    const active = figuresFor({ id: 'p-active', status: 'active', priceCents: 100000 }, [
      entry({ projectId: 'p-active', startedAt: '2026-08-01T09:00:00.000Z', endedAt: '2026-08-01T10:00:00.000Z' })
    ])

    const totals = projectTotals([draft, cancelled, active])

    expect(totals.count).toBe(1)
    expect(totals.price).toBe('$1,000.00')
    expect(totals.hours).toBe('1h 00m')
    // blendedRateCents([{100000, 60}]) = effectiveRateCents(100000, 60) = 100000
    expect(totals.rate).toBe('$1,000.00/hr')
  })
})
