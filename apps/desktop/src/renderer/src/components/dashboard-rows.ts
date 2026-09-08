import { budgetJudgement, daysBetween, formatCents, formatDuration, rateJudgement, rateVsFloorPercent, overdueJudgement } from '@trackit/shared'
import type { Client, Id, Invoice, Project } from '@trackit/shared'
import { localDateOf } from './local-dates'
import { plural } from './terms'
import type { ProjectFigures } from './project-rows'
import {
  averageDaysToPay,
  balanceOf,
  clientOf,
  isOpen,
  overdueDaysOf,
  symbolFor
} from './invoices-data'
import type { PaymentsByInvoice } from './client-rows'

export type Metrics = {
  unbilled: string
  unbilledCount: number
  oldestDays: number | null
  outstanding: string
  outstandingCount: number
  overdue: string | null
  overdueDays: number | null
  paidMonth: string
  paidMonthCount: number
  averageDays: number | null
}
export function dashboardMetrics(
  projects: Project[],
  invoices: Invoice[],
  payments: PaymentsByInvoice,
  today: string
): Metrics {
  const delivered = projects.filter((p) => p.status === 'delivered')
  const ages = delivered.map((p) => (p.deliveredAt ? daysBetween(localDateOf(p.deliveredAt), today) : 0))
  const open = invoices.filter(isOpen)
  const balances = open.map((i) => ({ balance: balanceOf(i, payments), late: overdueDaysOf(i, today) }))
  const overdue = balances.filter((b) => b.late !== null)
  const month = today.slice(0, 7)
  const thisMonth = Object.entries(payments).flatMap(([invoiceId, list]) =>
    list.filter((p) => localDateOf(p.paidAt).startsWith(month)).map((p) => ({ invoiceId, p }))
  )
  const settledThisMonth = invoices.filter(
    (i) => i.status === 'paid' && thisMonth.some((x) => x.invoiceId === i.id)
  )
  return {
    unbilled: formatCents(delivered.reduce((s, p) => s + p.priceCents, 0)),
    unbilledCount: delivered.length,
    oldestDays: ages.length ? Math.max(...ages) : null,
    outstanding: formatCents(balances.reduce((s, b) => s + b.balance, 0)),
    outstandingCount: open.length,
    overdue: overdue.length ? formatCents(overdue.reduce((s, b) => s + b.balance, 0)) : null,
    overdueDays: overdue.length ? Math.max(...overdue.map((b) => b.late as number)) : null,
    paidMonth: formatCents(thisMonth.reduce((s, x) => s + x.p.amountCents, 0)),
    paidMonthCount: new Set(thisMonth.map((x) => x.invoiceId)).size,
    averageDays: averageDaysToPay(settledThisMonth, payments)
  }
}

export type AttentionItem = { key: string; tone: 'negative' | 'warning'; subject: string; detail: string; action: string; projectId?: Id }
export function attentionItems(
  figures: ProjectFigures[],
  invoices: Invoice[],
  clients: Client[],
  payments: PaymentsByInvoice,
  floorCents: number,
  today: string
): AttentionItem[] {
  const late = invoices
    .map((i) => ({ i, days: overdueDaysOf(i, today) }))
    .filter((x): x is { i: Invoice; days: number } => x.days !== null)
  const chase = late.map(
    ({ i, days }): AttentionItem => ({
      key: `inv-${i.id}`,
      tone: overdueJudgement(days),
      subject: `Chase ${clientOf(i, clients)?.company ?? i.number}`,
      detail: `— ${i.number} is ${plural(days, 'day')} overdue, ${formatCents(balanceOf(i, payments), symbolFor(i))}`,
      action: 'Send reminder'
    })
  )
  const projects = figures
    .filter((f) => f.project.status === 'active')
    .flatMap((f): AttentionItem[] => {
      const { project: p, rateCents: rate, budget, checklist: c, symbol } = f
      const base = { key: `p-${p.id}`, projectId: p.id, action: 'Open project' }
      if (rate !== null && rateJudgement(rate, floorCents) === 'negative')
        return [
          {
            ...base,
            tone: 'negative',
            subject: `Renegotiate ${p.name}`,
            detail: `— ${formatCents(rate, symbol)}/hr, ${Math.abs(rateVsFloorPercent(rate, floorCents) ?? 0)}% under your ${formatCents(floorCents)} floor at ${formatDuration(f.loggedMinutes)} logged`
          }
        ]
      if (budget.over && budget.percent !== null)
        return [
          {
            ...base,
            tone: 'negative',
            subject: `Re-scope ${p.name}`,
            detail: `— ${budget.percent}% of budgeted hours spent against ${c.done} of ${plural(c.total, 'deliverable')} done`
          }
        ]
      if (c.later >= 3)
        return [
          {
            ...base,
            tone: 'warning',
            subject: `Bill added scope on ${p.name}`,
            detail: `— ${plural(c.later, 'deliverable')} added since kickoff, price unchanged`,
            action: 'Review scope'
          }
        ]
      if (budget.percent !== null && budgetJudgement(budget.percent) === 'warning')
        return [
          {
            ...base,
            tone: 'warning',
            subject: `Watch ${p.name}`,
            detail: `— ${budget.percent}% of budgeted hours used with ${plural(c.open, 'deliverable')} open`
          }
        ]
      return []
    })
  const negative = (x: AttentionItem): boolean => x.tone === 'negative'
  return [...chase.filter(negative), ...projects.filter(negative), ...projects.filter((x) => !negative(x)), ...chase.filter((x) => !negative(x))]
}
