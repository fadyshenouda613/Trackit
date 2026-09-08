import { useState, type JSX } from 'react'
import {
  addDays,
  currencies,
  nextInvoiceNumber,
  nextInvoiceSequence,
  shortDate,
  type Settings,
  type UpdateSettingsInput
} from '@trackit/shared'
import { Icon } from './Icon'
import { formFrom, parseScheme, parseTaxRate, parseTermDays, type SettingsForm } from './settings-data'
import { SettingsRow, SettingsSection } from './SettingsRow'
import { todayIso } from './local-dates'
import { useInvoices } from '../data/use-invoices'

type SettingsInvoicingProps = {
  settings: Settings
  onChange: (patch: UpdateSettingsInput) => void
}

/**
 * The defaults a new invoice starts from. Two of them state their consequence
 * live — the terms name the date they produce, the scheme names the number it
 * produces — because both are rules whose output is the thing you actually care
 * about, and neither is obvious from the rule alone.
 *
 * Tax, terms and the numbering scheme are held here as typed text and only
 * committed to the store when they parse: a rejected keystroke stays on
 * screen rather than reverting mid-edit, and the field alone still says why
 * with the same phrasing the previews below already use.
 */
export function SettingsInvoicing({ settings, onChange }: SettingsInvoicingProps): JSX.Element {
  const [form, setForm] = useState<SettingsForm>(() => formFrom(settings))
  const invoices = useInvoices()

  const days = parseTermDays(form.paymentTermsDays)
  const dueDate = days !== null ? shortDate(addDays(todayIso(), days)) : null

  const sequence = nextInvoiceSequence((invoices.data ?? []).map((i) => i.number), form.numberingScheme)
  const preview = nextInvoiceNumber(form.numberingScheme, sequence, new Date())

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
            /* Direct: a currency code has no invalid keystroke to buffer against. */
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
            value={form.taxRate}
            onChange={(event) => {
              const taxRate = event.target.value
              setForm((current) => ({ ...current, taxRate }))
              const parsed = parseTaxRate(taxRate)
              if (parsed !== null) onChange({ taxRate: parsed })
            }}
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
              value={form.paymentTermsDays}
              onChange={(event) => {
                const paymentTermsDays = event.target.value
                setForm((current) => ({ ...current, paymentTermsDays }))
                const parsed = parseTermDays(paymentTermsDays)
                if (parsed !== null) onChange({ paymentTermsDays: parsed })
              }}
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
            value={form.numberingScheme}
            onChange={(event) => {
              const numberingScheme = event.target.value
              setForm((current) => ({ ...current, numberingScheme }))
              const parsed = parseScheme(numberingScheme)
              if (parsed !== null) onChange({ numberingScheme: parsed })
            }}
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
