import { useRef, type JSX } from 'react'
import type { Settings, UpdateSettingsInput } from '@trackit/shared'
import { Logo } from './Logo'
import { SettingsRow, SettingsSection } from './SettingsRow'

type SettingsBusinessProps = {
  settings: Settings
  onChange: (patch: UpdateSettingsInput) => void
}

const fieldClass = (value: string): string => (value ? 'field field--filled' : 'field')

/**
 * Who the invoice is from. Every field here is printed on a document a client
 * keeps, which is why the section says so at the top rather than leaving you to
 * discover it on the first invoice you send.
 */
export function SettingsBusiness({ settings, onChange }: SettingsBusinessProps): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null)

  const pickLogo = (file: File | undefined): void => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange({ logo: String(reader.result) })
    reader.readAsDataURL(file)
  }

  return (
    <SettingsSection title="Business profile" note="Printed on every invoice you send.">
      <SettingsRow label="Your name" htmlFor="set-person">
        <input
          id="set-person"
          type="text"
          className={fieldClass(settings.person)}
          value={settings.person}
          onChange={(event) => onChange({ person: event.target.value })}
        />
      </SettingsRow>

      <SettingsRow
        label="Business name"
        htmlFor="set-business"
        hint="Leave it blank to invoice under your own name."
      >
        <input
          id="set-business"
          type="text"
          className={fieldClass(settings.businessName)}
          value={settings.businessName}
          onChange={(event) => onChange({ businessName: event.target.value })}
        />
      </SettingsRow>

      <SettingsRow label="Address" htmlFor="set-address">
        <textarea
          id="set-address"
          rows={3}
          className={fieldClass(settings.address)}
          value={settings.address}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </SettingsRow>

      <SettingsRow label="Email" htmlFor="set-email">
        <input
          id="set-email"
          type="email"
          className={fieldClass(settings.email)}
          value={settings.email}
          onChange={(event) => onChange({ email: event.target.value })}
        />
      </SettingsRow>

      <SettingsRow
        label="Phone"
        htmlFor="set-phone"
        hint="Optional. Some clients' accounts departments ask for one."
      >
        <input
          id="set-phone"
          type="tel"
          className={fieldClass(settings.phone)}
          value={settings.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
        />
      </SettingsRow>

      <SettingsRow label="Logo" hint="PNG or SVG, at least 240px tall. Sits above your address.">
        <div className="settings-logo">
          <div className="settings-logo__preview">
            {settings.logo ? (
              <img className="settings-logo__image" src={settings.logo} alt="" />
            ) : (
              /* The app's own mark stands in, greyed, so the tile shows the size
                 and position a logo will take rather than an empty box. */
              <div className="settings-logo__placeholder">
                <Logo size={22} />
              </div>
            )}
          </div>

          <div className="settings-logo__actions">
            <button type="button" className="button" onClick={() => fileRef.current?.click()}>
              {settings.logo ? 'Replace' : 'Upload logo'}
            </button>
            {settings.logo && (
              <button
                type="button"
                className="settings-logo__remove"
                onClick={() => onChange({ logo: null })}
              >
                Remove
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            hidden
            onChange={(event) => {
              pickLogo(event.target.files?.[0])
              /* Cleared so choosing the same file twice still fires. */
              event.target.value = ''
            }}
          />
        </div>
      </SettingsRow>
    </SettingsSection>
  )
}
