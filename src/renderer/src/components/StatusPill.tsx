import type { JSX } from 'react'
import { statusStyles, type Status } from './status'

type StatusPillProps = {
  status: Status
}

/** Every status chip in the app — projects and invoices alike. */
export function StatusPill({ status }: StatusPillProps): JSX.Element {
  const { label, background, color, border } = statusStyles[status]

  return (
    <span className="pill pill--md" style={{ background, color, border }}>
      {label}
    </span>
  )
}
