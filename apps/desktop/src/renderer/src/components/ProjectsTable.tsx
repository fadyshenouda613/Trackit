import { useMemo, type JSX } from 'react'
import type { Id } from '@trackit/shared'
import { formatCents } from '@trackit/shared'
import { Meter, toneVar } from './Meter'
import { dashboardRow, projectFigures } from './project-rows'
import { EmptyState } from './EmptyState'
import { TableSkeleton } from './TableSkeleton'
import { useChecklists } from '../data/use-checklist'
import { useClients } from '../data/use-clients'
import { useProjects } from '../data/use-projects'
import { useSettings } from '../data/use-settings'
import { useRunningTimer, useTimeEntries } from '../data/use-time'

type ProjectsTableProps = {
  onOpen?: (id: Id) => void
  /** Rows not in yet. The heading above them is known either way. */
  loading?: boolean
}

export function ProjectsTable({ onOpen, loading = false }: ProjectsTableProps): JSX.Element {
  const projects = useProjects({ status: 'active' })
  const clients = useClients()
  const entries = useTimeEntries()
  const settings = useSettings()
  const running = useRunningTimer()

  const projectList = projects.data ?? []
  const projectIds = useMemo(() => projectList.map((p) => p.id), [projectList])
  const checklists = useChecklists(projectIds)

  const anyPending =
    projects.isPending ||
    clients.isPending ||
    entries.isPending ||
    settings.isPending ||
    running.isPending ||
    checklists.isPending

  const rateFloorCents = settings.data?.rateFloorCents ?? 0

  const rows = anyPending
    ? []
    : projectList
        .map((p) =>
          projectFigures(
            p,
            clients.data ?? [],
            entries.data ?? [],
            (checklists.data ?? {})[p.id] ?? [],
            new Date().toISOString()
          )
        )
        .map((f) => dashboardRow(f, rateFloorCents, running.data?.projectId ?? null))

  return (
    <section className="section">
      {/*
       * The head stays while the rows load. What this table is, how many rows
       * it will have and the floor they are judged against are all known
       * before a single one of them arrives, and blanking them out would be
       * pretending to know less than the app does.
       */}
      <div className="section__head">
        <h2 className="section__title">Active projects</h2>
        <span className="section__count">{rows.length}</span>
        <div className="spacer" />
        <span className="section__note num">Rate floor {formatCents(rateFloorCents)}/hr</span>
      </div>

      {loading || anyPending ? (
        <TableSkeleton block="projects" />
      ) : (
        <div className="panel projects">
          <div className="projects__header t-overline">
            <span>Project</span>
            <span>Client</span>
            <span className="align-right">Price</span>
            <span>Checklist</span>
            <span className="align-right">Hours</span>
            <span>Budget</span>
            <span className="align-right">Effective rate</span>
          </div>

          {rows.length === 0 ? (
            /* Only a read that came back may say there are none; a refused one
               has already said what happened, as a toast. */
            projects.isSuccess ? (
              <EmptyState
                variant="panel"
                title="No active projects"
                body="Mark a draft active and its hours, budget and rate show up here."
              />
            ) : null
          ) : (
            rows.map((row) => (
              <div
                className="projects__row"
                key={row.id}
                role={onOpen ? 'button' : undefined}
                tabIndex={onOpen ? 0 : undefined}
                onClick={() => onOpen?.(row.id)}
                onKeyDown={(event) => {
                  if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    onOpen(row.id)
                  }
                }}
              >
                <div className={row.running ? 'projects__name' : 'projects__name projects__name--indented'}>
                  {row.running && (
                    <div
                      className="dot pulse"
                      style={{ background: 'var(--accent)' }}
                      aria-label="Timer running"
                    />
                  )}
                  <span className="projects__label truncate">{row.name}</span>
                </div>

                <span className="projects__client truncate">{row.client}</span>
                <span className="align-right">{row.price}</span>

                <div className="projects__checklist">
                  <span className="projects__checklist-count">{row.checklist}</span>
                  <Meter value={row.checklistPct} label={`Checklist ${row.checklist}`} />
                </div>

                <span className="projects__hours align-right">{row.hours}</span>

                <div className="projects__budget">
                  <Meter
                    value={row.budgetPct}
                    tone={row.budgetTone}
                    label={`Budget used ${row.budgetLabel}`}
                  />
                  <span
                    className="projects__budget-pct"
                    style={{ color: toneVar[row.budgetLabelTone] }}
                  >
                    {row.budgetLabel}
                  </span>
                </div>

                <div className="projects__rate">
                  <span className="projects__rate-value" style={{ color: toneVar[row.rateTone] }}>
                    {row.rate}
                    <span className="projects__rate-unit">/hr</span>
                  </span>
                  <span className="projects__rate-note" style={{ color: toneVar[row.noteTone] }}>
                    {row.note}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}
