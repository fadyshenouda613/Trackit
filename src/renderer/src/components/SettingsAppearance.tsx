import type { JSX } from 'react'
import { SettingsRow, SettingsSection } from './SettingsRow'
import { Segmented } from './Segmented'
import { prefersDark, type Theme } from './theme'

type SettingsAppearanceProps = {
  theme: Theme
  onChange: (theme: Theme) => void
}

/* Segmented speaks in labels rather than values, so the two are mapped here
   rather than the control being taught about themes. */
const options: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

const labelOf = (theme: Theme): string =>
  options.find((option) => option.value === theme)?.label ?? 'System'

/**
 * The one setting here that changes nothing about the data and everything about
 * the screen.
 *
 * "System" is the default and is listed last, after the two things it chooses
 * between, so the row reads as a choice with a standing instruction at the end
 * rather than as three palettes. When it is on, the hint says which way it has
 * currently gone — otherwise the only way to know is to look.
 */
export function SettingsAppearance({ theme, onChange }: SettingsAppearanceProps): JSX.Element {
  const following = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : null

  return (
    <SettingsSection
      title="Appearance"
      note="Which theme Trackit is drawn in. Applies to this machine, not to the account."
    >
      <SettingsRow
        label="Theme"
        hint={
          following
            ? `Following the system, which is currently ${following}.`
            : 'Fixed, whatever the system is set to.'
        }
      >
        <Segmented
          label="Theme"
          options={options.map((option) => option.label)}
          active={labelOf(theme)}
          onChange={(label) => {
            const picked = options.find((option) => option.label === label)
            if (picked) onChange(picked.value)
          }}
        />
      </SettingsRow>
    </SettingsSection>
  )
}
