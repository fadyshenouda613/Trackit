import type { JSX } from 'react'

type SegmentedProps = {
  options: string[]
  active: string
  label: string
}

/** The pill-thumb toggle: Active/Archived on Clients, the sort on Projects. */
export function Segmented({ options, active, label }: SegmentedProps): JSX.Element {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <span
          key={option}
          className={
            option === active ? 'segmented__option segmented__option--on' : 'segmented__option'
          }
        >
          {option}
        </span>
      ))}
    </div>
  )
}
