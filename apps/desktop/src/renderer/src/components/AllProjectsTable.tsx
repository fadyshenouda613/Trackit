import { useMemo, type JSX } from 'react'
import type { Id, ProjectListFilters } from '@trackit/shared'
import { EmptyState } from './EmptyState'
import { Meter } from './Meter'
import { allProjectRow, projectFigures, projectTotals } from './project-rows'
import { StatusPill } from './StatusPill'
import { TableSkeleton } from './TableSkeleton'
import { toneVar } from './tone'
import { useChecklists } from '../data/use-checklist'
import { useClients } from '../data/use-clients'
import { useProjects } from '../data/use-projects'
import { useSettings } from '../data/use-settings'
import { useRunningTimer, useTimeEntries } from '../data/use-time'

type AllProjectsTableProps = {
  filters: ProjectListFilters
  /** Opens the project detail screen. */
  onOpen: (id: Id) => void
  onNewProject?: () => void
}

export function AllProjectsTable({ filters, onOpen, onNewProject }: AllProjectsTableProps): JSX.Element {
  const projects = useProjects(filters)
  const clients = useClients()
  const entries = useTimeEntries()
  const settings = useSettings()
  const running = useRunningTimer()

  const projectList = projects.data ?? []
  const projectIds = useMemo(() => projectList.map((p) => p.id), [projectList])
  const checklists = useChecklists(projectIds)

  const pending =
    projects.isPending ||
    clients.isPending ||
    entries.isPending ||
    settings.isPending ||
    running.isPending ||
    checklists.isPending

  if (pending) return <TableSkeleton block="all-projects" />

  const now = new Date().toISOString()
  const rateFloorCents = settings.data?.rateFloorCents ?? 0
  const runningProjectId = running.data?.projectId ?? null
  const clientList = clients.data ?? []
  const entryList = entries.data ?? []
  const checklistsByProject = checklists.data ?? {}

  const figures = projectList.map((p) =>
    projectFigures(p, clientList, entryList, checklistsByProject[p.id] ?? [], now)
  )
  const rows = figures.map((f) => allProjectRow(f, rateFloorCents, runningProjectId))
  const totals = projectTotals(figures)

  /* Whether anything is filtering the list down, as opposed to the store
     itself holding no projects. "Recent" et al. are a sort, not a filter. */
  const hasFilters = filters.status !== undefined || filters.clientId !== undefined || Boolean(filters.search)

  return (
    <div className="panel all-projects">
      <div className="all-projects__header t-overline">
        <span>Project</span>
        <span>Client</span>
        <span className="align-right">Price</span>
        <span>Status</span>
        <span>Checklist</span>
        <span className="align-right">Hours</span>
        <span>Budget</span>
        <span className="align-right">Effective rate</span>
        <span className="align-right">Delivered</span>
      </div>

      {rows.length === 0 ? (
        /* Only a read that came back may say the list is empty; a refused one
           has already said what happened, as a toast. */
        projects.isSuccess ? (
          <EmptyState
            variant="panel"
            title={hasFilters ? 'No projects match those filters' : 'No projects yet'}
            body={
              hasFilters
                ? 'Clear one of them to widen the list.'
                : 'Price a piece of work and log hours against it; the effective rate falls out.'
            }
            action={hasFilters ? undefined : { label: 'New project', onClick: onNewProject }}
          />
        ) : null
      ) : (
        rows.map((row) => {
          const draft = row.status === 'draft'
          const cancelled = row.status === 'cancelled'

          return (
            <div
              className={cancelled ? 'all-projects__row all-projects__row--dim' : 'all-projects__row'}
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(row.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(row.id)
                }
              }}
            >
              {row.running ? (
                <div className="all-projects__name">
                  <div
                    className="dot pulse"
                    style={{ background: 'var(--accent)' }}
                    aria-label="Timer running"
                  />
                  <span className="all-projects__label truncate">{row.name}</span>
                </div>
              ) : (
                <span
                  className={[
                    'all-projects__label',
                    'all-projects__label--indented',
                    'truncate',
                    draft ? 'all-projects__label--quiet' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {row.name}
                </span>
              )}

              <span
                className={cancelled ? 'all-projects__client--quiet truncate' : 'all-projects__client truncate'}
              >
                {row.client}
              </span>

              <span
                className={
                  draft || cancelled ? 'align-right all-projects__quiet' : 'align-right'
                }
              >
                {row.price}
              </span>

              <span>
                <StatusPill status={row.status} />
              </span>

              <div className="all-projects__meter-cell">
                <span
                  className={
                    draft || cancelled
                      ? 'all-projects__checklist all-projects__quiet'
                      : 'all-projects__checklist'
                  }
                >
                  {row.checklist}
                </span>
                {row.checklistPct === null ? (
                  <div className="meter" aria-hidden="true" />
                ) : (
                  <Meter value={row.checklistPct} label={`Checklist ${row.checklist}`} />
                )}
              </div>

              <span
                className={
                  draft || cancelled ? 'align-right all-projects__quiet' : 'align-right all-projects__hours'
                }
              >
                {row.hours}
              </span>

              <div className="all-projects__meter-cell">
                {row.budgetPct === null ? (
                  <div className="meter" aria-hidden="true" />
                ) : (
                  <Meter
                    value={row.budgetPct}
                    tone={row.budgetTone}
                    label={`Budget used ${row.budgetLabel}`}
                  />
                )}
                <span
                  className="all-projects__budget-pct"
                  style={{ color: toneVar[row.budgetLabelTone] }}
                >
                  {row.budgetLabel}
                </span>
              </div>

              <span className="align-right all-projects__rate" style={{ color: toneVar[row.rateTone] }}>
                {row.rate}
              </span>

              <span className="align-right all-projects__quiet">{row.delivered}</span>
            </div>
          )
        })
      )}

      {/*
       * Totals count only the projects that represent real work: draft has
       * agreed nothing and cancelled will never be billed, so both would
       * distort the money and drag the blended rate down. Hours follow the
       * same basis, or the rate would not reconcile with the two figures
       * beside it.
       */}
      <div className="all-projects__row all-projects__totals">
        <div className="all-projects__totals-head">
          <span className="all-projects__totals-title">Totals across {totals.count} projects</span>
          <span className="all-projects__totals-basis">
            Draft and cancelled excluded from all three figures
          </span>
        </div>

        <span className="align-right all-projects__totals-value">{totals.price}</span>
        <span />
        <span />
        <span className="align-right all-projects__totals-value">{totals.hours}</span>

        <div className="all-projects__totals-figure">
          <span className="all-projects__totals-value">{totals.rate}</span>
          <span className="all-projects__totals-caption">
            Blended — active and delivered work only
          </span>
        </div>

        <span />
      </div>
    </div>
  )
}
