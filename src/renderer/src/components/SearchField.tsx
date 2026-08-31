import type { JSX } from 'react'
import { Icon } from './Icon'

type SearchFieldProps = {
  placeholder: string
  /** 260px on Clients, 232px on Projects. */
  width: number
}

/** The inert search affordance both list toolbars show. */
export function SearchField({ placeholder, width }: SearchFieldProps): JSX.Element {
  return (
    <div className="list-toolbar__search" style={{ width }}>
      <Icon name="search" size={13} className="list-toolbar__search-icon" />
      <span className="list-toolbar__search-text">{placeholder}</span>
    </div>
  )
}
