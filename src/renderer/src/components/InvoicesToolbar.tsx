import type { JSX } from 'react'
import { FilterDropdown } from './FilterDropdown'
import { SearchField } from './SearchField'
import { Segmented } from './Segmented'

export const ALL = 'All'

type InvoicesToolbarProps = {
  status: string
  onStatus: (value: string) => void
  statuses: string[]
  client: string
  onClient: (value: string) => void
  clients: string[]
  sort: string
  onSort: (value: string) => void
}

/**
 * The same 44px bar the Clients and Projects screens carry, with the two
 * filters the brief asks for. Unlike those two these are live: on a money list
 * the point of narrowing the rows is watching the outstanding figure narrow
 * with them, which a drawn-but-inert control cannot show.
 */
export function InvoicesToolbar({
  status,
  onStatus,
  statuses,
  client,
  onClient,
  clients,
  sort,
  onSort
}: InvoicesToolbarProps): JSX.Element {
  return (
    <div className="list-toolbar list-toolbar--projects">
      <SearchField placeholder="Search invoices" width={232} />
      <FilterDropdown label="Status" value={status} options={statuses} onChange={onStatus} />
      <FilterDropdown label="Client" value={client} options={clients} onChange={onClient} />
      <div className="spacer" />
      <span className="list-toolbar__sort">Sort</span>
      <Segmented
        options={['Issued', 'Due', 'Total', 'Client']}
        active={sort}
        label="Sort invoices"
        onChange={onSort}
      />
    </div>
  )
}
