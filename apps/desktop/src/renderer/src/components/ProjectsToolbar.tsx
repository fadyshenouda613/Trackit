import type { JSX } from 'react'
import { FilterDropdown } from './FilterDropdown'
import { SearchField } from './SearchField'
import { Segmented } from './Segmented'

/** The 44px filter and sort bar under the Projects header. Inert as drawn. */
export function ProjectsToolbar(): JSX.Element {
  return (
    <div className="list-toolbar list-toolbar--projects">
      <SearchField placeholder="Search projects" width={232} />
      <FilterDropdown label="Status" value="All" />
      <FilterDropdown label="Client" value="All" />
      <div className="spacer" />
      <span className="list-toolbar__sort">Sort</span>
      <Segmented
        options={['Recent', 'Rate', 'Price', 'Client']}
        active="Recent"
        label="Sort projects"
      />
    </div>
  )
}
