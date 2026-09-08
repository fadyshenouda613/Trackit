import { useMemo, type JSX } from 'react'
import type { Id } from '@trackit/shared'
import { attentionItems } from './dashboard-rows'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { localDateOf } from './local-dates'
import { projectFigures } from './project-rows'
import { toneVar } from './tone'
import { useInvoiceFigures } from './use-invoice-figures'
import { useChecklists } from '../data/use-checklist'
import { useClients } from '../data/use-clients'
import { useInvoices } from '../data/use-invoices'
import { useProjects } from '../data/use-projects'
import { useSettings } from '../data/use-settings'
import { useTimeEntries } from '../data/use-time'

type AttentionListProps = {
  /** Opens the project detail screen; rows for an invoice chase have no project and stay inert. */
  onOpenProject: (id: Id) => void
}

export function AttentionList({ onOpenProject }: AttentionListProps): JSX.Element {
  const projects = useProjects({ status: 'active' })
  const clients = useClients()
  const entries = useTimeEntries()
  const invoices = useInvoices()
  const settings = useSettings()
  const { payments, isPending: paymentsPending } = useInvoiceFigures(invoices.data)

  const projectList = projects.data ?? []
  const projectIds = useMemo(() => projectList.map((p) => p.id), [projectList])
  const checklists = useChecklists(projectIds)

  const anyPending =
    projects.isPending ||
    clients.isPending ||
    entries.isPending ||
    invoices.isPending ||
    settings.isPending ||
    checklists.isPending ||
    paymentsPending

  /*
   * One timestamp for the whole derivation, and one derivation per change to
   * what it reads. The shell re-renders on a clock of its own, and re-figuring
   * every project on the dashboard each time it ticks is work nobody asked
   * for — none of these rows can change without one of these queries changing.
   */
  const items = useMemo(() => {
    if (anyPending) return []
    const now = new Date().toISOString()
    const clientList = clients.data ?? []
    const figures = projectList.map((p) =>
      projectFigures(p, clientList, entries.data ?? [], (checklists.data ?? {})[p.id] ?? [], now)
    )
    return attentionItems(
      figures,
      invoices.data ?? [],
      clientList,
      payments,
      settings.data?.rateFloorCents ?? 0,
      localDateOf(now)
    )
  }, [
    anyPending,
    projectList,
    clients.data,
    entries.data,
    checklists.data,
    invoices.data,
    payments,
    settings.data
  ])

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Attention</h2>
        <span className="section__count">{anyPending ? '—' : items.length}</span>
      </div>

      <div className="panel">
        {anyPending ? null : items.length === 0 ? (
          /* "Nothing needs attention" is a conclusion drawn from the projects
             and the invoices; if either read was refused there is no such
             conclusion to draw, and the toast has already said why. */
          projects.isSuccess && invoices.isSuccess ? (
            <EmptyState
              variant="panel"
              title="Nothing needs attention"
              body="Every invoice is inside its terms and every active project is inside its budget and above your floor."
            />
          ) : null
        ) : (
          items.map((item) => (
            <div
              className="attention__row"
              key={item.key}
              role={item.projectId ? 'button' : undefined}
              tabIndex={item.projectId ? 0 : undefined}
              onClick={item.projectId ? () => onOpenProject(item.projectId as Id) : undefined}
              onKeyDown={
                item.projectId
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onOpenProject(item.projectId as Id)
                      }
                    }
                  : undefined
              }
            >
              <div className="dot" style={{ background: toneVar[item.tone] }} aria-hidden="true" />
              <span>
                <span className="attention__subject">{item.subject}</span>{' '}
                <span className="attention__detail">{item.detail}</span>
              </span>
              <div className="spacer" />
              <span className="attention__action">{item.action}</span>
              <Icon name="chevron" size={12} className="attention__chevron" />
            </div>
          ))
        )}
      </div>
    </section>
  )
}
