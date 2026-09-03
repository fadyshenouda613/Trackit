import { useRef, useState, type JSX } from 'react'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { SyncPopover } from './SyncPopover'
import { SyncStatus } from './SyncStatus'
import { snapshots, type SyncState } from './sync-data'
import { useNow } from './use-now'

export type NavKey = 'dashboard' | 'clients' | 'projects' | 'time' | 'invoices' | 'settings'

type NavEntry = {
  key: NavKey
  label: string
  icon: IconName
  /** Nothing to open yet on a new account. */
  disabled?: boolean
}

const nav: NavEntry[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'clients', label: 'Clients', icon: 'clients' },
  { key: 'projects', label: 'Projects', icon: 'projects' },
  { key: 'time', label: 'Time', icon: 'time' },
  { key: 'invoices', label: 'Invoices', icon: 'invoices' },
  { key: 'settings', label: 'Settings', icon: 'settings' }
]

const emptyDisabled: NavKey[] = ['projects', 'time', 'invoices']

type SidebarProps = {
  variant?: 'populated' | 'empty'
  active?: NavKey
  /**
   * Counts differ per artboard — the Dashboard shows 7 clients, the Clients
   * screen shows 8 — so each screen passes its own rather than sharing one.
   */
  counts?: Partial<Record<NavKey, string>>
  /**
   * The badge on Invoices, which is the number of overdue ones. Counted by the
   * caller from the register rather than typed here, so paying the last late
   * invoice clears it instead of leaving a 2 behind.
   */
  overdueInvoices?: number
  /** Drives the marker on Time; the Clients frames run no timer. */
  timerRunning?: boolean
  syncState?: SyncState
  onSyncNow?: () => void
  onNavigate?: (key: NavKey) => void
}

export function Sidebar({
  variant = 'populated',
  active = 'dashboard',
  counts = {},
  overdueInvoices = 0,
  timerRunning = false,
  syncState = 'saved',
  onSyncNow,
  onNavigate
}: SidebarProps): JSX.Element {
  const empty = variant === 'empty'
  const [syncOpen, setSyncOpen] = useState(false)
  const syncButton = useRef<HTMLButtonElement>(null)
  /* Only mounted here, because this is the only place a relative time shows. */
  const now = useNow()
  const snapshot = snapshots[syncState]

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Logo size={18} />
        <span className="sidebar__name">Trackit</span>
      </div>

      {!empty && (
        <div className="sidebar__search-wrap">
          <div className="sidebar__search">
            <Icon name="search" size={13} />
            <span className="sidebar__search-text">Search</span>
            <div className="spacer" />
            <span className="sidebar__kbd">⌘K</span>
          </div>
        </div>
      )}

      <nav className={empty ? 'sidebar__nav sidebar__nav--roomy' : 'sidebar__nav'}>
        {nav.map((entry) => {
          const isActive = entry.key === active
          const disabled = empty && emptyDisabled.includes(entry.key)
          const count = empty ? undefined : counts[entry.key]
          const running = !empty && entry.key === 'time' && timerRunning
          const badge =
            !empty && entry.key === 'invoices' && overdueInvoices > 0
              ? String(overdueInvoices)
              : undefined

          return (
            <button
              key={entry.key}
              type="button"
              disabled={disabled}
              onClick={() => onNavigate?.(entry.key)}
              className={[
                'nav-item',
                isActive ? 'nav-item--active' : '',
                disabled ? 'nav-item--disabled' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon name={entry.icon} />
              {entry.label}
              {(count || badge || running) && <div className="spacer" />}
              {count && <span className="nav-item__count num">{count}</span>}
              {badge && <span className="nav-item__badge num">{badge}</span>}
              {running && (
                <div className="dot" style={{ background: 'var(--accent)' }} aria-hidden="true" />
              )}
            </button>
          )
        })}
      </nav>

      <div className="spacer" />

      <div className="sidebar__footer">
        {/* A new account has synced nothing and has nothing waiting, so the
            footer states where the work is and offers no detail behind it. */}
        {empty ? (
          <SyncStatus
            snapshot={snapshots.saved}
            label="Saved on this Mac"
            time={null}
          />
        ) : (
          <SyncStatus
            snapshot={snapshot}
            now={now}
            buttonRef={syncButton}
            open={syncOpen}
            onToggle={() => setSyncOpen((value) => !value)}
          />
        )}

        {syncOpen && !empty && (
          <SyncPopover
            snapshot={snapshot}
            now={now}
            onClose={() => setSyncOpen(false)}
            returnFocus={() => syncButton.current?.focus()}
            onSyncNow={() => {
              setSyncOpen(false)
              onSyncNow?.()
            }}
          />
        )}
      </div>
    </aside>
  )
}
