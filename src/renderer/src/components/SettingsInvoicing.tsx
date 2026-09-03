import type { JSX } from 'react'
import { Icon } from './Icon'
import { SettingsRow, SettingsSection } from './SettingsRow'
import { currencies, nextInvoiceNumber, type Settings } from './settings-data'
import { addDays, shortDate, TODAY } from './time-data'

type SettingsInvoicingProps = {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

/**
 * The defaults a new invoice starts from. Two of them state their consequence
 * live — the terms name the date they produce, the scheme names the number it
 * produces — because both are rules whose output is the thing you actually care
 * about, and neither is obvious from the rule alone.
 */
export function SettingsInvoicing({ settings, onChange }: SettingsInvoicingProps): JSX.Element {
  const days = Number(settings.paymentTermsDays)
  const dueDate =
    Number.isFinite(days) && days >= 0 && settings.paymentTermsDays.trim()
      ? shortDate(addDays(TODAY, days))
      : null

  const preview = nextInvoiceNumber(settings.numberingScheme)

  return (
    <SettingsSection
      title="Invoicing"
      note="What a new invoice starts with. Any of it can be changed on the invoice itself."
    >
      <SettingsRow
        label="Default currency"
        htmlFor="set-currency"
        hint="A client billed in another currency keeps their own."
      >
        <div className="select-wrap">
          <select
            id="set-currency"
            className="field field--filled"
            value={settings.currency}
            onChange={(event) =>
              onChange({ currency: event.target.value as Settings['currency'] })
            }
          >
            {currencies.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.code} ({entry.symbol}) — {entry.label}
              </option>
            ))}
          </select>
          <Icon name="caret" size={12} className="select-wrap__caret" />
        </div>
      </SettingsRow>

      <SettingsRow
        label="Tax rate"
        htmlFor="set-tax"
        hint="Applied to the subtotal. Set it to 0 if you do not charge tax."
      >
        <div className="field field--filled pct-field">
          <input
            id="set-tax"
            type="text"
            className="pct-field__input num"
            value={settings.taxRate}
            onChange={(event) => onChange({ taxRate: event.target.value })}
          />
          <span className="hours-field__suffix">%</span>
        </div>
      </SettingsRow>

      <SettingsRow label="Payment terms" htmlFor="set-terms">
        <div className="settings-row__stack">
          <div className="field field--filled pct-field">
            <input
              id="set-terms"
              type="text"
              className="pct-field__input num"
              value={settings.paymentTermsDays}
              onChange={(event) => onChange({ paymentTermsDays: event.target.value })}
            />
            <span className="hours-field__suffix">days</span>
          </div>
          <span className="settings-row__hint">
            {dueDate
              ? `An invoice issued today would be due ${dueDate}.`
              : 'Enter a whole number of days.'}
          </span>
        </div>
      </SettingsRow>

      <SettingsRow
        label="Numbering"
        htmlFor="set-numbering"
        hint={
          <>
            A run of zeros is the counter and sets its width. <code className="t-mono">{'{YYYY}'}</code>,{' '}
            <code className="t-mono">{'{YY}'}</code> and <code className="t-mono">{'{MM}'}</code> are
            filled in at issue.
          </>
        }
      >
        <div className="settings-row__stack">
          <input
            id="set-numbering"
            type="text"
            className="field field--filled t-mono"
            value={settings.numberingScheme}
            onChange={(event) => onChange({ numberingScheme: event.target.value })}
          />

          <div className="settings-preview">
            <span className="t-overline settings-preview__label">Next invoice</span>
            <div className="spacer" />
            {preview ? (
              <span className="settings-preview__value t-mono">{preview}</span>
            ) : (
              /* Not an error, and so not red: red in this app means money in
                 trouble. The scheme is simply not yet one the app can count. */
              <span className="settings-preview__blank">
                Add a run of zeros for the counter
              </span>
            )}
          </div>
        </div>
      </SettingsRow>
    </SettingsSection>
  )
}
