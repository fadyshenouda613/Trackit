import { useState, type JSX } from 'react'
import type { UpdateSettingsInput } from '@trackit/shared'
import { SettingsAccount } from './SettingsAccount'
import { SettingsAppearance } from './SettingsAppearance'
import { SettingsBusiness } from './SettingsBusiness'
import { SettingsData } from './SettingsData'
import { SettingsInvoicing } from './SettingsInvoicing'
import { SettingsTracking } from './SettingsTracking'
import type { SyncSnapshot } from './sync-data'
import { TopBar } from './TopBar'
import { useSettings, useUpdateSettings } from '../data/use-settings'
import type { Theme } from './theme'

type SectionKey = 'business' | 'invoicing' | 'tracking' | 'appearance' | 'account' | 'data'

const sections: { key: SectionKey; label: string }[] = [
  { key: 'business', label: 'Business profile' },
  { key: 'invoicing', label: 'Invoicing' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'account', label: 'Account and sync' },
  { key: 'data', label: 'Data' }
]

type SettingsScreenProps = {
  sync: SyncSnapshot
  onSyncNow: () => void
  isTopmost: boolean
  /** Passed straight through: the account section owns the button, the app owns
      what signing out means. */
  onSignOut: () => void
  /* Not part of Settings: theme is a preference of this machine, kept in
     localStorage, and is never written to the settings row. Owned by the app,
     like the sync snapshot. */
  theme: Theme
  onTheme: (theme: Theme) => void
  /** Forced by the States panel's Data axis, independent of the query's own state. */
  loading?: boolean
}

/**
 * Settings owns its whole header, like Time and Create invoice: the sub-nav is
 * part of the screen rather than part of the shell, and the bar above has to
 * stay put while the pane beside it scrolls.
 *
 * One section is on screen at a time. A single long scroll would put the rate
 * floor — the one setting here with consequences elsewhere in the app — halfway
 * down a page of addresses and tax rates.
 */
export function SettingsScreen({
  sync,
  onSyncNow,
  isTopmost,
  onSignOut,
  theme,
  onTheme,
  loading = false
}: SettingsScreenProps): JSX.Element {
  const [section, setSection] = useState<SectionKey>('business')
  const settingsQuery = useSettings()
  const update = useUpdateSettings()
  const settings = settingsQuery.data
  const pending = loading || settingsQuery.isPending || !settings
  const onChange = (patch: UpdateSettingsInput): void => update.mutate(patch)

  return (
    <>
      <TopBar title="Settings" isTopmost={isTopmost} />

      <div className="settings">
        <nav className="settings__nav" aria-label="Settings sections">
          {sections.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={
                entry.key === section ? 'settings__nav-item settings__nav-item--on' : 'settings__nav-item'
              }
              aria-current={entry.key === section ? 'page' : undefined}
              onClick={() => setSection(entry.key)}
            >
              {entry.label}
            </button>
          ))}

          <div className="spacer" />

          {/* There is no Save button, so the screen says so once, quietly, in
              the one place that is always on screen. */}
          <span className="settings__nav-note">Changes apply as you make them.</span>
        </nav>

        <div className="settings__pane">
          <div className="settings__inner">
            {/* Appearance and Data need no row from the store, so they are the
                one pane that still draws while settings is in flight. */}
            {section === 'appearance' && <SettingsAppearance theme={theme} onChange={onTheme} />}
            {section === 'data' && <SettingsData />}
            {!pending && (
              <>
                {section === 'business' && (
                  <SettingsBusiness settings={settings} onChange={onChange} />
                )}
                {section === 'invoicing' && (
                  <SettingsInvoicing settings={settings} onChange={onChange} />
                )}
                {section === 'tracking' && (
                  <SettingsTracking settings={settings} onChange={onChange} />
                )}
                {section === 'account' && (
                  <SettingsAccount
                    settings={settings}
                    sync={sync}
                    onSyncNow={onSyncNow}
                    onSignOut={onSignOut}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
