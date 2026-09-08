import { useEffect, useRef, useState, type JSX } from 'react'
import type { CreateClientInput, CurrencyCode, Id } from '@trackit/shared'
import { currencies } from '@trackit/shared'
import { useCreateClient } from '../data/use-clients'
import { Icon } from './Icon'
import { TERMS } from './terms'

type NewClientModalProps = {
  onClose: () => void
  onCreated?: (id: Id) => void
}

type Fields = {
  name: string
  company: string
  email: string
  address: string
  currency: CurrencyCode
  termDays: number
  notes: string
}

const initial: Fields = {
  name: '',
  company: '',
  email: '',
  address: '',
  currency: 'USD',
  termDays: 14,
  notes: ''
}

export function toCreateClientInput(f: Fields): CreateClientInput {
  return {
    id: crypto.randomUUID(),
    name: f.name.trim(),
    company: f.company.trim(),
    email: f.email.trim(),
    phone: '',
    address: f.address,
    currency: f.currency,
    paymentTermsDays: f.termDays,
    notes: f.notes
  }
}

/**
 * "One column, seven fields, no steps." The form opens empty; Create writes
 * through `useCreateClient` and hands the new id back so the app can select it.
 */
export function NewClientModal({ onClose, onCreated }: NewClientModalProps): JSX.Element {
  const [fields, setFields] = useState<Fields>(initial)
  const dialogRef = useRef<HTMLDivElement>(null)
  const create = useCreateClient()

  const invalidEmail = fields.email.trim() !== '' && !fields.email.includes('@')
  const canCreate = fields.name.trim() !== '' && !invalidEmail && !create.isPending

  const submit = (): void => {
    if (!canCreate) return
    create.mutate(toCreateClientInput(fields), {
      onSuccess: (client) => {
        onCreated?.(client.id)
        onClose()
      }
    })
  }

  /* `submit` closes over the current fields, so the listener reads it through a
     ref rather than re-subscribing (and refocusing) on every keystroke. */
  const submitRef = useRef(submit)
  submitRef.current = submit

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        submitRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const set =
    <K extends keyof Fields>(key: K) =>
    (value: Fields[K]) =>
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
                onChange={(event) => set('currency')(event.target.value as CurrencyCode)}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.label}
                  </option>
                ))}
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
                value={fields.termDays}
                onChange={(event) => set('termDays')(Number(event.target.value))}
              >
                {TERMS.map((term) => (
                  <option key={term.days} value={term.days}>
                    {term.label}
                  </option>
                ))}
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
          <button
            type="button"
            className="button button--primary dialog__create"
            disabled={!canCreate}
            onClick={submit}
          >
            Create client
            <span className="empty__kbd">⌘↩</span>
          </button>
        </div>
      </div>
    </div>
  )
}
