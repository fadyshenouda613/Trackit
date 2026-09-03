import { useState, type JSX } from 'react'
import { SettingsAccount } from './SettingsAccount'
import { SettingsAppearance } from './SettingsAppearance'
import { SettingsBusiness } from './SettingsBusiness'
import { SettingsData } from './SettingsData'
import { SettingsInvoicing } from './SettingsInvoicing'
import { SettingsTracking } from './SettingsTracking'
import type { SyncState } from './sync-data'
import { TopBar } from './TopBar'
import type { Settings } from './settings-data'
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
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  syncState: SyncState
  isTopmost: boolean
  /** Passed straight through: the account section owns the button, the app owns
      what signing out means. */
  onSignOut: () => void
  /* Not part of Settings: that is seed data a reload resets, and this is the
     one preference that outlives the window. Owned by the app, like syncState. */
  theme: Theme
  onTheme: (theme: Theme) => void
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
  settings,
  onChange,
  syncState,
  isTopmost,
  onSignOut,
  theme,
  onTheme
}: SettingsScreenProps): JSX.Element {
  const [section, setSection] = useState<SectionKey>('business')

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
            {section === 'business' && (
              <SettingsBusiness settings={settings} onChange={onChange} />
            )}
            {section === 'invoicing' && (
              <SettingsInvoicing settings={settings} onChange={onChange} />
            )}
            {section === 'tracking' && (
              <SettingsTracking settings={settings} onChange={onChange} />
            )}
            {section === 'appearance' && (
              <SettingsAppearance theme={theme} onChange={onTheme} />
            )}
            {section === 'account' && (
              <SettingsAccount
                settings={settings}
                syncState={syncState}
                onSignOut={onSignOut}
              />
            )}
            {section === 'data' && <SettingsData />}
          </div>
        </div>
      </div>
    </>
  )
}
