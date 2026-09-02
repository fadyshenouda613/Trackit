import { useEffect, useRef, useState, type JSX } from 'react'
import { Icon } from './Icon'

type FilterDropdownProps = {
  label: string
  value: string
  /**
   * Omit to get the drawn-but-inert control the Projects toolbar uses. Supply
   * both of these and the same control opens a real menu — one component, so a
   * live filter and a drawn one can never look like different things.
   */
  options?: string[]
  onChange?: (value: string) => void
}

/** The Status / Client filters on a list toolbar. */
export function FilterDropdown({
  label,
  value,
  options,
  onChange
}: FilterDropdownProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const live = Boolean(options && onChange)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const face = (
    <>
      <span className="filter-dropdown__label">{label}</span>
      <span className="filter-dropdown__value">{value}</span>
      <Icon name="caret" size={11} className="filter-dropdown__caret" />
    </>
  )

  if (!live) return <div className="filter-dropdown">{face}</div>

  return (
    <div className="overflow filter-dropdown__wrap" ref={wrap}>
      <button
        type="button"
        className={open ? 'filter-dropdown filter-dropdown--open' : 'filter-dropdown'}
        aria-expanded={open}
        aria-label={`${label} filter`}
        onClick={() => setOpen((current) => !current)}
      >
        {face}
      </button>

      {open && (
        <div className="overflow__menu overflow__menu--left" role="menu">
          {options?.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === value}
              className={
                option === value
                  ? 'overflow__item overflow__item--on'
                  : 'overflow__item'
              }
              onClick={() => {
                onChange?.(option)
                setOpen(false)
              }}
            >
              {option}
              {option === value && (
                <>
                  <div className="spacer" />
                  <Icon name="check" size={12} className="overflow__tick" />
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
