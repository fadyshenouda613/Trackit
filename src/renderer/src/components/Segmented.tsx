import type { JSX } from 'react'

type SegmentedProps = {
  options: string[]
  active: string
  label: string
  /**
   * Omit for the drawn-but-inert toggle the Clients and Projects toolbars use.
   * Supply it and the same control becomes a real one — one component, so a
   * live segment and a drawn one can never look like different things.
   */
  onChange?: (value: string) => void
}

/** The pill-thumb toggle: Active/Archived on Clients, the sort on Projects. */
export function Segmented({ options, active, label, onChange }: SegmentedProps): JSX.Element {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => {
        const className =
          option === active ? 'segmented__option segmented__option--on' : 'segmented__option'

        return onChange ? (
          <button
            key={option}
            type="button"
            className={className}
            aria-pressed={option === active}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ) : (
          <span key={option} className={className}>
            {option}
          </span>
        )
      })}
    </div>
  )
}
