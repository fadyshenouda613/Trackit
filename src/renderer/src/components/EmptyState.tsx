import type { JSX } from 'react'

/** What the window shows before there is a single client on file. */
export function EmptyState(): JSX.Element {
  return (
    <div className="empty">
      <div className="empty__inner">
        <div className="empty__mark" />
        <h2 className="t-title">Start with a client</h2>
        <p className="t-body empty__body">
          Add whoever is paying you. Projects, hours and invoices all hang off a client, and
          Ledgerline starts working out your real hourly rate from the first entry.
        </p>
        <div className="empty__actions">
          <button type="button" className="empty__cta">
            Add your first client
            <span className="empty__kbd">⌘N</span>
          </button>
          <span className="empty__aside">
            or <a href="#">import from a CSV</a>
          </span>
        </div>
      </div>
    </div>
  )
}
