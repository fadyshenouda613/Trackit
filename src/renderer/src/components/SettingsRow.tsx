import type { JSX, ReactNode } from 'react'

/*
 * The two shapes every Settings section is built from.
 *
 * A settings row puts its label and its explanation on the left and the control
 * on the right, so the column of labels reads as a list of what the app knows
 * about you — scannable without reading a single value. The dialogs stack label
 * over field instead, because a dialog is one task and this is an inventory.
 */

type SettingsSectionProps = {
  title: string
  /** One line under the heading saying what the section is for. */
  note?: string
  children: ReactNode
}

export function SettingsSection({ title, note, children }: SettingsSectionProps): JSX.Element {
  return (
    <section className="settings-section">
      <div className="settings-section__head">
        <h2 className="settings-section__title">{title}</h2>
        {note && <p className="settings-section__note">{note}</p>}
      </div>
      {children}
    </section>
  )
}

type SettingsRowProps = {
  label: string
  /** Omitted when the control is not a single labellable field. */
  htmlFor?: string
  hint?: ReactNode
  children: ReactNode
}

export function SettingsRow({ label, htmlFor, hint, children }: SettingsRowProps): JSX.Element {
  return (
    <div className="settings-row">
      <div className="settings-row__text">
        {htmlFor ? (
          <label className="settings-row__label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="settings-row__label">{label}</span>
        )}
        {hint && <span className="settings-row__hint">{hint}</span>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  )
}
