import {
  blendedRateCents,
  budgetConsumption,
  budgetJudgement,
  checklistProgress,
  effectiveRateCents,
  entryMinutes,
  formatCents,
  formatDuration,
  hoursToMinutes,
  rateJudgement,
  rateVsFloorPercent,
  symbolOf,
  totalMinutes
} from '@trackit/shared'
import type {
  BudgetConsumption,
  ChecklistItem,
  ChecklistProgress,
  Client,
  Id,
  Invoice,
  Payment,
  Project,
  ProjectStatus,
  TimeEntry
} from '@trackit/shared'
import { hoursLabel } from './client-rows'
import { dayMonth, longDate } from './local-dates'
import type { TextTone } from './tone'

export type ProjectFigures = {
  project: Project
  client: Client | null
  symbol: string
  entries: TimeEntry[]
  loggedMinutes: number
  budgetMinutes: number
  budget: BudgetConsumption
  checklist: ChecklistProgress & { later: number; open: number }
  rateCents: number | null
}

export function projectFigures(
  project: Project,
  clients: Client[],
  entries: TimeEntry[],
  items: ChecklistItem[],
  now: string
): ProjectFigures {
  const mine = entries.filter((e) => e.projectId === project.id)
  const loggedMinutes = totalMinutes(mine, now)
  const budgetMinutes = hoursToMinutes(project.budgetedHours)
  const progress = checklistProgress(items)
  return {
    project,
    client: clients.find((c) => c.id === project.clientId) ?? null,
    symbol: symbolOf(project.currency),
    entries: mine,
    loggedMinutes,
    budgetMinutes,
    budget: budgetConsumption(loggedMinutes, budgetMinutes),
    checklist: {
      ...progress,
      later: items.filter((i) => i.addedAfterKickoff).length,
      open: progress.total - progress.done
    },
    rateCents: project.status === 'cancelled' ? null : effectiveRateCents(project.priceCents, loggedMinutes)
  }
}

/** Fill tone and label tone, which the tables tone separately. */
export function budgetTones(f: ProjectFigures): { fill: TextTone; label: TextTone } {
  const { status } = f.project
  if (status === 'draft' || f.budget.percent === null) return { fill: 'neutral', label: 'neutral' }
  if (status === 'cancelled') return { fill: 'secondary', label: 'neutral' }
  const j = budgetJudgement(f.budget.percent)
  return { fill: j, label: j === 'positive' ? 'neutral' : j }
}

/** The all-projects table's row (its `Row` type moves here, plus `id`). */
export type AllProjectRow = {
  id: Id
  name: string
  client: string
  price: string
  status: ProjectStatus
  checklist: string
  checklistPct: number | null
  hours: string
  budgetPct: number | null
  budgetLabel: string
  budgetTone: TextTone
  budgetLabelTone: TextTone
  rate: string
  rateTone: TextTone
  delivered: string
  running?: boolean
}
export function allProjectRow(f: ProjectFigures, floorCents: number, runningProjectId: Id | null): AllProjectRow {
  const { project: p } = f
  const draft = p.status === 'draft'
  const tones = budgetTones(f)
  return {
    id: p.id,
    name: p.name,
    client: f.client?.company ?? '—',
    price: formatCents(p.priceCents, f.symbol),
    status: p.status,
    checklist: `${f.checklist.done}/${f.checklist.total}`,
    checklistPct: draft ? null : f.checklist.percent,
    hours: hoursLabel(f.loggedMinutes),
    budgetPct: draft ? null : f.budget.percent,
    budgetLabel: draft || f.budget.percent === null ? '—' : `${f.budget.percent}%`,
    budgetTone: tones.fill,
    budgetLabelTone: tones.label,
    rate: f.rateCents === null ? '—' : `${formatCents(f.rateCents, f.symbol)}/hr`,
    rateTone: f.rateCents === null ? 'neutral' : rateJudgement(f.rateCents, floorCents),
    delivered: p.deliveredAt ? dayMonth(p.deliveredAt) : '—',
    running: runningProjectId === p.id
  }
}

export type ProjectTotals = { count: number; price: string; hours: string; rate: string }
/** Draft and cancelled excluded from all three figures, as the footer says. */
export function projectTotals(figures: ProjectFigures[]): ProjectTotals {
  const real = figures.filter((f) => f.project.status !== 'draft' && f.project.status !== 'cancelled')
  const blended = blendedRateCents(real.map((f) => ({ priceCents: f.project.priceCents, loggedMinutes: f.loggedMinutes })))
  return {
    count: real.length,
    price: formatCents(real.reduce((s, f) => s + f.project.priceCents, 0)),
    hours: hoursLabel(real.reduce((s, f) => s + f.loggedMinutes, 0)),
    rate: blended === null ? '—' : `${formatCents(blended)}/hr`
  }
}

/** The dashboard table's row (ProjectsTable's local `ProjectRow` moves here). */
export type DashboardRow = {
  id: Id
  name: string
  client: string
  price: string
  checklist: string
  checklistPct: number
  hours: string
  budgetPct: number
  budgetLabel: string
  budgetTone: TextTone
  budgetLabelTone: TextTone
  rate: string
  rateTone: TextTone
  note: string
  noteTone: TextTone
  running?: boolean
}
export function dashboardRow(f: ProjectFigures, floorCents: number, runningProjectId: Id | null): DashboardRow {
  const tones = budgetTones(f)
  const pct = f.budget.percent ?? 0
  let rateTone: TextTone = 'neutral'
  let note = 'No hours logged yet'
  let noteTone: TextTone = 'neutral'
  if (f.rateCents !== null) {
    const j = rateJudgement(f.rateCents, floorCents)
    const vs = rateVsFloorPercent(f.rateCents, floorCents) ?? 0
    rateTone = j
    if (j === 'negative') {
      note = `−${Math.abs(vs)}% below floor`
      noteTone = 'negative'
    } else if (j === 'warning') {
      note = `+${vs}% · marginal`
      noteTone = 'warning'
    } else if (pct < 50) note = `early · ${f.checklist.open} items open`
    else note = `+${vs}% vs floor`
  }
  return {
    id: f.project.id,
    name: f.project.name,
    client: f.client?.company ?? '—',
    price: formatCents(f.project.priceCents, f.symbol),
    checklist: `${f.checklist.done}/${f.checklist.total}`,
    checklistPct: f.checklist.percent,
    hours: hoursLabel(f.loggedMinutes),
    budgetPct: pct,
    budgetLabel: `${pct}%`,
    budgetTone: tones.fill,
    budgetLabelTone: tones.label,
    rate: f.rateCents === null ? '—' : formatCents(f.rateCents, f.symbol),
    rateTone,
    note,
    noteTone,
    running: runningProjectId === f.project.id
  }
}

export type SessionRow = { id: Id; date: string; note: string; length: string }
export const sessionRows = (entries: TimeEntry[], now: string): SessionRow[] =>
  [...entries]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((e) => ({ id: e.id, date: dayMonth(e.startedAt), note: e.note, length: formatDuration(entryMinutes(e, now)) }))

export type HistoryEntry = { label: string; date: string }
export function statusHistory(p: Project, invoice: Invoice | null, payments: Payment[]): HistoryEntry[] {
  const out: HistoryEntry[] = [{ label: 'Draft created', date: longDate(p.createdAt) }]
  if (p.kickoffAt && p.status !== 'draft') out.push({ label: 'Marked active', date: longDate(p.kickoffAt) })
  if (p.deliveredAt) out.push({ label: 'Marked delivered', date: longDate(p.deliveredAt) })
  if (invoice?.issuedAt) out.push({ label: `Invoiced — ${invoice.number}`, date: longDate(invoice.issuedAt) })
  if (p.status === 'paid') {
    const last = payments.map((x) => x.paidAt).sort().at(-1)
    out.push({ label: 'Paid in full', date: longDate(last ?? p.updatedAt) })
  }
  if (p.status === 'cancelled') out.push({ label: 'Cancelled', date: longDate(p.updatedAt) })
  return out
}
