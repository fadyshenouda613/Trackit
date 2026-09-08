import { useState, type JSX } from 'react'
import { formatCents, type Settings, type UpdateSettingsInput } from '@trackit/shared'
import { formFrom, parseRateFloor, type SettingsForm } from './settings-data'
import { projectFigures } from './project-rows'
import { SettingsRow, SettingsSection } from './SettingsRow'
import { SettingsShortcutField } from './SettingsShortcutField'
import { toneVar } from './tone'
import { useClients } from '../data/use-clients'
import { useProjects } from '../data/use-projects'
import { useTimeEntries } from '../data/use-time'

type SettingsTrackingProps = {
  settings: Settings
  onChange: (patch: UpdateSettingsInput) => void
}

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
  const [form, setForm] = useState<SettingsForm>(() => formFrom(settings))
  const projects = useProjects()
  const clients = useClients()
  const entries = useTimeEntries()

  const now = new Date().toISOString()
  const rated = (projects.data ?? [])
    .map((p) => projectFigures(p, clients.data ?? [], entries.data ?? [], [], now).rateCents)
    .filter((rate): rate is number => rate !== null)

  const floorCents = parseRateFloor(form.rateFloor)

  const below = floorCents === null ? null : rated.filter((rate) => rate < floorCents).length
  const share = below === null ? null : below / rated.length

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
              value={form.rateFloor}
              onChange={(event) => {
                const rateFloor = event.target.value
                setForm((current) => ({ ...current, rateFloor }))
                const parsed = parseRateFloor(rateFloor)
                if (parsed !== null) onChange({ rateFloorCents: parsed })
              }}
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
                {floorCents === null
                  ? 'Enter a rate to see how your projects measure up'
                  : `Across ${rated.length} projects with hours logged against a price`}
              </span>
            </div>

            <div className="spacer" />

            <div className="implied__figure">
              <span className="implied__rate num" style={{ color: toneVar[tone] }}>
                {below === null ? '—' : below}
                {below !== null && <span className="implied__unit"> of {rated.length}</span>}
              </span>
              <span className="implied__note">
                {floorCents === null ? 'No floor set' : `fall below ${formatCents(floorCents)}/hr`}
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
