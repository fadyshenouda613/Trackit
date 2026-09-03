import { useEffect, useRef, useState, type JSX } from 'react'
import { Icon } from './Icon'

type NewClientModalProps = {
  onClose: () => void
}

type Fields = {
  name: string
  company: string
  email: string
  address: string
  currency: string
  terms: string
  notes: string
}

const initial: Fields = {
  // Pre-filled in the artboard, which is what gives this field the active border.
  name: 'Marguerite Oyelaran',
  company: '',
  email: '',
  address: '',
  currency: 'USD ($) — US Dollar',
  terms: 'Net 14',
  notes: ''
}

/**
 * "One column, seven fields, no steps." The form is live so it can be filled in
 * and tabbed through, but there is no data layer yet: Create and Cancel both
 * just close.
 */
export function NewClientModal({ onClose }: NewClientModalProps): JSX.Element {
  const [fields, setFields] = useState<Fields>(initial)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const set = (key: keyof Fields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }))

  /* line.strong marks an active field; empty ones keep the default divider. */
  const fieldClass = (value: string): string => (value ? 'field field--filled' : 'field')

  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div
        className="dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-client-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog__head">
          <h2 className="dialog__title" id="new-client-title">
            New client
          </h2>
          <div className="spacer" />
          <button type="button" className="dialog__close" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={12} />
          </button>
        </div>

        <div className="dialog__body">
          <div className="field-row">
            <label htmlFor="nc-name">Name</label>
            <input
              id="nc-name"
              type="text"
              className={fieldClass(fields.name)}
              value={fields.name}
              onChange={(event) => set('name')(event.target.value)}
            />
          </div>

          <div className="field-row">
            <label htmlFor="nc-company">Company</label>
            <input
              id="nc-company"
              type="text"
              placeholder="Optional"
              className={fieldClass(fields.company)}
              value={fields.company}
              onChange={(event) => set('company')(event.target.value)}
            />
          </div>

          <div className="field-row">
            <label htmlFor="nc-email">Email</label>
            <input
              id="nc-email"
              type="email"
              placeholder="name@company.com"
              className={fieldClass(fields.email)}
              value={fields.email}
              onChange={(event) => set('email')(event.target.value)}
            />
          </div>

          <div className="field-row">
            <label htmlFor="nc-address">Billing address</label>
            <textarea
              id="nc-address"
              rows={2}
              placeholder="Street, city, postcode, country"
              className={fieldClass(fields.address)}
              value={fields.address}
              onChange={(event) => set('address')(event.target.value)}
            />
          </div>

          <div className="field-row">
            <label htmlFor="nc-currency">Currency</label>
            <div className="select-wrap">
              <select
                id="nc-currency"
                className="field"
                value={fields.currency}
                onChange={(event) => set('currency')(event.target.value)}
              >
                <option>USD ($) — US Dollar</option>
                <option>EUR (€) — Euro</option>
                <option>GBP (£) — Pound Sterling</option>
              </select>
              <Icon name="caret" size={12} className="select-wrap__caret" />
            </div>
          </div>

          <div className="field-row">
            <label htmlFor="nc-terms">Default payment terms</label>
            <div className="select-wrap">
              <select
                id="nc-terms"
                className="field"
                value={fields.terms}
                onChange={(event) => set('terms')(event.target.value)}
              >
                <option>Net 14</option>
                <option>Net 7</option>
                <option>Net 30</option>
                <option>Due on receipt</option>
              </select>
              <Icon name="caret" size={12} className="select-wrap__caret" />
            </div>
          </div>

          <div className="field-row">
            <label htmlFor="nc-notes">Notes</label>
            <textarea
              id="nc-notes"
              rows={2}
              placeholder="Anything worth remembering before the first project"
              className={fieldClass(fields.notes)}
              value={fields.notes}
              onChange={(event) => set('notes')(event.target.value)}
            />
          </div>
        </div>

        <div className="dialog__foot">
          <span className="dialog__foot-note">Saved on this Mac only</span>
          <div className="spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button button--primary dialog__create" onClick={onClose}>
            Create client
            <span className="empty__kbd">⌘↩</span>
          </button>
        </div>
      </div>
    </div>
  )
}
