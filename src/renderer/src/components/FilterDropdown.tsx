import type { JSX } from 'react'
import { Icon } from './Icon'

type FilterDropdownProps = {
  label: string
  value: string
}

/** The Status / Client filters on the Projects toolbar. Inert as drawn. */
export function FilterDropdown({ label, value }: FilterDropdownProps): JSX.Element {
  return (
    <div className="filter-dropdown">
      <span className="filter-dropdown__label">{label}</span>
      <span className="filter-dropdown__value">{value}</span>
      <Icon name="caret" size={11} className="filter-dropdown__caret" />
    </div>
  )
}
