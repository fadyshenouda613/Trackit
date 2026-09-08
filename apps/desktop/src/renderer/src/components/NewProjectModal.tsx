import { useEffect, useRef, useState, type JSX } from 'react'
import type { CreateProjectInput, CurrencyCode, Id } from '@trackit/shared'
import { currencies, parseMoney, parseMoneyToCents, shortDate } from '@trackit/shared'
import { atLocal, parseShortDate, todayIso } from './local-dates'
import { useClients } from '../data/use-clients'
import { useCreateProject } from '../data/use-projects'
import { useSettings } from '../data/use-settings'
import { Icon } from './Icon'
import { ImpliedRate } from './ImpliedRate'
import { Pill } from './Pill'

type NewProjectModalProps = {
  onClose: () => void
  initialClientId?: Id
  onCreated?: (id: Id) => void
}

type Fields = {
  clientId: Id | ''
  name: string
  description: string
  price: string
  currency: CurrencyCode
  budgetHours: string
  start: string
  due: string
}

export function toCreateProjectInput(f: Fields): CreateProjectInput | null {
  const priceCents = parseMoneyToCents(f.price)
  const hours = parseMoney(f.budgetHours)
  const start = f.start.trim() ? parseShortDate(f.start) : null
  const due = f.due.trim() ? parseShortDate(f.due) : null
  if (!f.clientId || !f.name.trim() || priceCents === null || priceCents < 0) return null
  if ((f.start.trim() && !start) || (f.due.trim() && !due)) return null
  return {
    id: crypto.randomUUID(),
    clientId: f.clientId,
    name: f.name.trim(),
    description: f.description,
    priceCents,
    currency: f.currency,
    budgetedHours: hours ?? 0,
    status: 'draft',
    kickoffAt: start ? atLocal(start, 0) : null,
    dueAt: due ? atLocal(due, 0) : null,
    deliveredAt: null
  }
}

/**
 * "Fixed fee for the whole project · implied rate previews live." The price and
 * hours fields feed the preview card; Create writes through `useCreateProject`
 * and hands the new id back.
 */
export function NewProjectModal({
  onClose,
  initialClientId,
  onCreated
}: NewProjectModalProps): JSX.Element {
  const clients = useClients()
  const settings = useSettings()
  const create = useCreateProject()
  const clientList = clients.data ?? []

  const [fields, setFields] = useState<Fields>(() => ({
    clientId: initialClientId ?? '',
    name: '',
    description: '',
    price: '',
    currency: settings.data?.currency ?? 'USD',
    budgetHours: '',
    start: shortDate(todayIso()),
    due: ''
  }))
  const dialogRef = useRef<HTMLDivElement>(null)

  const input = toCreateProjectInput(fields)

  const submit = (): void => {
    if (!input || create.isPending) return
    create.mutate(input, {
      onSuccess: (project) => {
        onCreated?.(project.id)
        onClose()
      }
    })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const set =
    <K extends keyof Fields>(key: K) =>
    (value: Fields[K]) =>
      setFields((current) => ({ ...current, [key]: value }))

  const fieldClass = (value: string): string => (value ? 'field field--filled' : 'field')

  return (
    <div className="scrim scrim--high" onClick={onClose} role="presentation">
      <div
        className="dialog dialog--wide"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog__head">
          <h2 className="dialog__title" id="new-project-title">
            New project
          </h2>
          <span className="dialog__head-meta">Fixed fee</span>
          <div className="spacer" />
          <button type="button" className="dialog__close" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={12} />
          </button>
        </div>

        <div className="dialog__body">
          <div className="field-row">
            <label htmlFor="np-client">Client</label>
            <div className="select-wrap">
              <select
                id="np-client"
                className={fields.clientId ? 'field field--filled' : 'field'}
                value={fields.clientId}
                onChange={(event) => {
                  const clientId = event.target.value as Id
                  set('clientId')(clientId)
                  const chosen = clientList.find((c) => c.id === clientId)
                  if (chosen) set('currency')(chosen.currency)
                }}
              >
                {!fields.clientId && <option value="">Choose a client…</option>}
                {clientList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} — {c.name}
                  </option>
                ))}
              </select>
              <Icon name="caret" size={12} className="select-wrap__caret" />
            </div>
          </div>

          <div className="field-row">
            <label htmlFor="np-name">Project name</label>
            <input
              id="np-name"
              type="text"
              className={fieldClass(fields.name)}
              value={fields.name}
              onChange={(event) => set('name')(event.target.value)}
            />
          </div>

          <div className="field-row">
            <label htmlFor="np-desc">Description</label>
            <textarea
              id="np-desc"
              rows={2}
              placeholder="What you agreed to deliver, in the client's words"
              className={fieldClass(fields.description)}
              value={fields.description}
              onChange={(event) => set('description')(event.target.value)}
            />
          </div>

          <div className="dialog__rule" />

          <div className="field-row">
            <div className="field-row__head">
              <label htmlFor="np-price">Agreed price</label>
              <Pill tone="accent">Fixed fee, whole project</Pill>
            </div>

            <div className="field-row__pair">
              <div className="field field--filled money-field">
                <span className="money-field__symbol num">$</span>
                <input
                  id="np-price"
                  type="text"
                  className="money-field__input num"
                  value={fields.price}
                  onChange={(event) => set('price')(event.target.value)}
                />
              </div>

              <div className="select-wrap select-wrap--narrow">
                <select
                  aria-label="Currency"
                  className="field"
                  value={fields.currency}
                  onChange={(event) => set('currency')(event.target.value as CurrencyCode)}
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
                <Icon name="caret" size={12} className="select-wrap__caret" />
              </div>
            </div>

            <span className="field-row__hint">
              The total you invoice on completion. Trackit never multiplies this by your hours.
            </span>
          </div>

          <div className="field-row">
            <label htmlFor="np-budget">Estimated hours budget</label>
            <div className="field-row__inline">
              <div className="field hours-field">
                <input
                  id="np-budget"
                  type="text"
                  className="hours-field__input num"
                  value={fields.budgetHours}
                  onChange={(event) => set('budgetHours')(event.target.value)}
                />
                <span className="hours-field__suffix">hrs</span>
              </div>
              <span className="field-row__aside">
                Your own estimate. Only used to warn you as you approach it.
              </span>
            </div>
          </div>

          <ImpliedRate
            price={fields.price}
            hours={fields.budgetHours}
            rateFloorCents={settings.data?.rateFloorCents ?? 0}
          />

          <div className="field-row__split">
            <div className="field-row">
              <label htmlFor="np-start">Start date</label>
              <input
                id="np-start"
                type="text"
                className={`${fieldClass(fields.start)} num`}
                value={fields.start}
                onChange={(event) => set('start')(event.target.value)}
              />
            </div>
            <div className="field-row">
              <label htmlFor="np-due">Due date</label>
              <input
                id="np-due"
                type="text"
                className={`${fieldClass(fields.due)} num`}
                value={fields.due}
                onChange={(event) => set('due')(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="dialog__foot">
          <span className="dialog__foot-note">Starts as a draft</span>
          <div className="spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary dialog__create"
            disabled={!input || create.isPending}
            onClick={submit}
          >
            Create project
            <span className="empty__kbd">⌘↩</span>
          </button>
        </div>
      </div>
    </div>
  )
}
