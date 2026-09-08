import type { JSX } from 'react'
import type { Client, ProjectListFilters, ProjectSort, ProjectStatus } from '@trackit/shared'
import { projectStatusSchema } from '@trackit/shared'
import { FilterDropdown } from './FilterDropdown'
import { SearchField } from './SearchField'
import { Segmented } from './Segmented'
import { statusStyles } from './status'

type ProjectsToolbarProps = {
  filters: ProjectListFilters
  onFilters: (next: ProjectListFilters) => void
  clients: Client[]
}

const STATUS_OPTIONS = ['All', ...projectStatusSchema.options.map((status) => statusStyles[status].label)]

const SORTS: Record<ProjectSort, string> = { recent: 'Recent', rate: 'Rate', price: 'Price', client: 'Client' }
const SORT_LABELS = Object.values(SORTS)
const sortFromLabel = (label: string): ProjectSort =>
  (Object.keys(SORTS) as ProjectSort[]).find((key) => SORTS[key] === label) ?? 'recent'

/** The 44px filter and sort bar under the Projects header. */
export function ProjectsToolbar({ filters, onFilters, clients }: ProjectsToolbarProps): JSX.Element {
  const firstStatus = Array.isArray(filters.status) ? filters.status[0] : filters.status
  const statusValue = firstStatus ? statusStyles[firstStatus as ProjectStatus].label : 'All'

  const companies = [...new Set(clients.map((c) => c.company))].sort()
  const clientValue = filters.clientId
    ? (clients.find((c) => c.id === filters.clientId)?.company ?? 'All')
    : 'All'

  return (
    <div className="list-toolbar list-toolbar--projects">
      <SearchField placeholder="Search projects" width={232} />
      <FilterDropdown
        label="Status"
        value={statusValue}
        options={STATUS_OPTIONS}
        onChange={(value) => {
          if (value === 'All') {
            onFilters({ ...filters, status: undefined })
            return
          }
          const status = projectStatusSchema.options.find((s) => statusStyles[s].label === value)
          onFilters({ ...filters, status })
        }}
      />
      <FilterDropdown
        label="Client"
        value={clientValue}
        options={['All', ...companies]}
        onChange={(value) => {
          if (value === 'All') {
            onFilters({ ...filters, clientId: undefined })
            return
          }
          const clientId = clients.find((c) => c.company === value)?.id
          onFilters({ ...filters, clientId })
        }}
      />
      <div className="spacer" />
      <span className="list-toolbar__sort">Sort</span>
      <Segmented
        options={SORT_LABELS}
        active={SORTS[filters.sort ?? 'recent']}
        label="Sort projects"
        onChange={(value) => onFilters({ ...filters, sort: sortFromLabel(value) })}
      />
    </div>
  )
}
