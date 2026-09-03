import type { JSX } from 'react'
import { SearchField } from './SearchField'
import { Segmented } from './Segmented'

/**
 * The 44px filter bar under the Clients header. Rendered as designed but not
 * wired: there are no archived clients in the data, and search would filter a
 * fixed set of rows.
 */
export function ListToolbar(): JSX.Element {
  return (
    <div className="list-toolbar">
      <SearchField placeholder="Search clients" width={260} />
      <Segmented options={['Active', 'Archived']} active="Active" label="Client status" />
      <div className="spacer" />
      <span className="list-toolbar__sort num">Sorted by outstanding</span>
    </div>
  )
}
