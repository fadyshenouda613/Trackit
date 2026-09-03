import type { JSX } from 'react'
import { projectRows } from './AllProjectsTable'
import { formatMoney, parseMoney } from '@trackit/shared'
import { SettingsRow, SettingsSection } from './SettingsRow'
import { SettingsShortcutField } from './SettingsShortcutField'
import type { Settings } from './settings-data'
import { toneVar } from './tone'

type SettingsTrackingProps = {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

/* The effective rates the Projects screen is showing, read back out of the rows
   it renders rather than restated here — a second copy of these figures would
   be a second place for them to drift. */
const ratedProjects = projectRows
  .map((row) => parseMoney(row.rate.replace('/hr', '')))
  .filter((rate): rate is number => rate !== null)

/**
 * The floor, and the one screen that explains what it is.
 *
 * This is the most consequential value in the app: it is the line every
 * project's effective rate is measured against, and the only reason any figure
 * anywhere turns red. So it does not sit here as a bare number — it says what
 * it is not (a billing rate), what it does, and how many of the projects you
 * already have fall below whatever you have just typed.
 */
export function SettingsTracking({ settings, onChange }: SettingsTrackingProps): JSX.Element {
  const floor = parseMoney(settings.rateFloor)

  const below = floor === null ? null : ratedProjects.filter((rate) => rate < floor).length
  const share = below === null ? null : below / ratedProjects.length

  /* Tone the count the way the app tones any judged figure: some projects under
     the floor is ordinary, most of them under it is the number telling you
     something. Zero is not celebrated — it may only mean the floor is too low. */
  const tone =
    share === null ? 'neutral' : share === 0 ? 'secondary' : share > 0.5 ? 'negative' : 'warning'

  return (
    <SettingsSection
      title="Tracking"
      note="How Trackit judges the hours you log, and how you start and stop the clock."
    >
      <SettingsRow label="Effective rate floor" htmlFor="set-floor">
        <div className="settings-row__stack">
          <div className="field field--filled money-field money-field--fixed">
            <span className="money-field__symbol num">$</span>
            <input
              id="set-floor"
              type="text"
              className="money-field__input num"
              value={settings.rateFloor}
              onChange={(event) => onChange({ rateFloor: event.target.value })}
            />
            <span className="money-field__suffix">/hr</span>
          </div>

          <p className="t-body settings-prose">
            This is not what you charge. Trackit never multiplies it by your hours and it never
            appears on an invoice. It is the line your <strong>effective</strong> rate — the
            agreed price divided by the hours you actually logged — is measured against, and the
            single reason a figure anywhere in the app turns red.
          </p>

          <div className="implied settings-consequence">
            <div className="implied__text">
              <span className="t-overline implied__label">What this changes</span>
              <span className="implied__basis">
                {floor === null
                  ? 'Enter a rate to see how your projects measure up'
                  : `Across ${ratedProjects.length} projects with hours logged against a price`}
              </span>
            </div>

            <div className="spacer" />

            <div className="implied__figure">
              <span className="implied__rate num" style={{ color: toneVar[tone] }}>
                {below === null ? '—' : below}
                {below !== null && (
                  <span className="implied__unit"> of {ratedProjects.length}</span>
                )}
              </span>
              <span className="implied__note">
                {floor === null ? 'No floor set' : `fall below ${formatMoney(floor)}/hr`}
              </span>
            </div>
          </div>
        </div>
      </SettingsRow>

      <SettingsRow label="Start / stop shortcut">
        <SettingsShortcutField
          value={settings.shortcut}
          onChange={(shortcut) => onChange({ shortcut })}
        />
      </SettingsRow>
    </SettingsSection>
  )
}
