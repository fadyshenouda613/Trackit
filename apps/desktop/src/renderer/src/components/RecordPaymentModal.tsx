import { useEffect, useState, type JSX } from 'react'
import { Icon } from './Icon'
import { money, parseMoney } from './money'
import { toneVar } from './tone'
import { TODAY, shortDate } from './time-data'
import {
  balanceOf,
  paidOf,
  paymentMethods,
  totalOf,
  type Invoice,
  type Payment,
  type PaymentMethod
} from './invoices-data'

type RecordPaymentModalProps = {
  invoice: Invoice
  onClose: () => void
  onRecord: (payment: Payment) => void
}

let nextPaymentId = 0

/**
 * Recording a payment is one number, and the reason the dialog is not just a
 * number is the line underneath it.
 *
 * The amount opens at the whole remaining balance, because that is what most
 * payments are, and the freelancer who is recording a part payment is the one
 * who knows to change it. Whatever they type, the band below says what the
 * invoice will owe afterwards — so the decision is read as a consequence rather
 * than as arithmetic to do in your head. Typing more than is owed is not
 * blocked, only named: overpayments happen, and a dialog that refuses the
 * figure on the bank statement is a dialog you have to work around.
 */
export function RecordPaymentModal({
  invoice,
  onClose,
  onRecord
}: RecordPaymentModalProps): JSX.Element {
  const outstanding = balanceOf(invoice)
  const alreadyPaid = paidOf(invoice)

  const [amount, setAmount] = useState(
    outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
  const [date, setDate] = useState(shortDate(TODAY))
  const [method, setMethod] = useState<PaymentMethod>('Bank transfer')
  const [note, setNote] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const value = parseMoney(amount)
  const valid = value !== null && value > 0
  const remaining = valid ? outstanding - value : outstanding
  const over = remaining < 0

  const tone = !valid ? 'neutral' : over ? 'negative' : remaining === 0 ? 'positive' : 'secondary'

  const figure = (): string => {
    if (!valid) return money(outstanding)
    return over ? money(Math.abs(remaining)) : money(remaining)
  }

  const caption = (): string => {
    if (!valid) return 'Enter an amount to see the balance it leaves'
    if (over) return 'More than is owed'
    return remaining === 0 ? 'Paid in full' : 'Still outstanding'
  }

  const submit = (): void => {
    if (!valid) return
    nextPaymentId += 1
    onRecord({
      id: `p-new-${nextPaymentId}`,
      date: TODAY,
      amount: value,
      method,
      note: note.trim() || undefined
    })
  }

  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-payment-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog__head">
          <h2 className="dialog__title" id="record-payment-title">
            Record payment
          </h2>
          <span className="dialog__head-meta t-mono">{invoice.number}</span>
          <div className="spacer" />
          <button type="button" className="dialog__close" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={12} />
          </button>
        </div>

        <div className="dialog__body">
          <div className="field-row">
            <label htmlFor="rp-amount">Amount received</label>
            <div className="field field--filled money-field">
              <span className="money-field__symbol num">$</span>
              <input
                id="rp-amount"
                type="text"
                className="money-field__input num"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <span className="field-row__hint">
              Opens at the full {money(outstanding)} outstanding. Change it for a part payment.
            </span>
          </div>

          <div className="field-row__split">
            <div className="field-row">
              <label htmlFor="rp-date">Date received</label>
              <input
                id="rp-date"
                type="text"
                className="field field--filled num"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <div className="field-row">
              <label htmlFor="rp-method">Method</label>
              <div className="select-wrap">
                <select
                  id="rp-method"
                  className="field field--filled"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                >
                  {paymentMethods.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <Icon name="caret" size={12} className="select-wrap__caret" />
              </div>
            </div>
          </div>

          <div className="field-row">
            <label htmlFor="rp-note">Note</label>
            <input
              id="rp-note"
              type="text"
              placeholder="Reference, or what it covers"
              className={note ? 'field field--filled' : 'field'}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {/* The consequence, live — the register this app already uses to show
              an implied rate as a price and an hours budget are typed. */}
          <div className="implied">
            <div className="implied__text">
              <span className="t-overline implied__label">
                {over ? 'Overpayment' : 'Balance after this payment'}
              </span>
              <span className="implied__basis">
                {money(totalOf(invoice))} invoiced
                {alreadyPaid > 0 ? ` · ${money(alreadyPaid)} already received` : ''}
              </span>
            </div>

            <div className="spacer" />

            <div className="implied__figure">
              <span className="implied__rate" style={{ color: toneVar[tone] }}>
                {figure()}
              </span>
              <span className="implied__note">{caption()}</span>
            </div>
          </div>
        </div>

        <div className="dialog__foot">
          <span className="dialog__foot-note t-mono">Recorded against {invoice.number}</span>
          <div className="spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary dialog__create"
            disabled={!valid}
            onClick={submit}
          >
            Record payment
            <span className="empty__kbd">⌘↩</span>
          </button>
        </div>
      </div>
    </div>
  )
}
