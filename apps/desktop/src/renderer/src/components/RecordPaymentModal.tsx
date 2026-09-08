import { useEffect, useState, type JSX } from 'react'
import { Icon } from './Icon'
import {
  balanceCents,
  formatCents,
  formatMoney,
  paidCents,
  parseMoneyToCents,
  paymentMethodLabels,
  shortDate,
  type Invoice,
  type Payment,
  type PaymentMethod
} from '@trackit/shared'
import { toneVar } from './tone'
import { atLocal, parseShortDate, todayIso } from './local-dates'
import { symbolFor } from './invoices-data'
import { useRecordPayment } from '../data/use-payments'

type RecordPaymentModalProps = {
  invoice: Invoice
  payments: Payment[]
  onClose: () => void
  /** The payment the store wrote, so the toast can quote the figure it stored. */
  onRecorded: (payment: Payment) => void
}

const methods = Object.entries(paymentMethodLabels) as [PaymentMethod, string][]

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
  payments,
  onClose,
  onRecorded
}: RecordPaymentModalProps): JSX.Element {
  const symbol = symbolFor(invoice)
  const alreadyPaid = paidCents(payments)
  const outstanding = balanceCents(invoice.totalCents, alreadyPaid)
  const record = useRecordPayment()

  /* The field holds major units while it is being typed — the symbol sits
     beside it — and is read back to cents at the edge, on submit. */
  const [amount, setAmount] = useState(formatMoney(outstanding / 100, ''))
  const [date, setDate] = useState(shortDate(todayIso()))
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer')
  const [note, setNote] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const cents = parseMoneyToCents(amount)
  const day = parseShortDate(date)
  const valid = cents !== null && cents > 0 && day !== null
  const readable = cents !== null && cents > 0
  const remaining = readable ? outstanding - cents : outstanding
  const over = remaining < 0

  const tone = !readable ? 'neutral' : over ? 'negative' : remaining === 0 ? 'positive' : 'secondary'

  const figure = (): string => {
    if (!readable) return formatCents(outstanding, symbol)
    return formatCents(Math.abs(remaining), symbol)
  }

  const caption = (): string => {
    if (!readable) return 'Enter an amount to see the balance it leaves'
    if (over) return 'More than is owed'
    return remaining === 0 ? 'Paid in full' : 'Still outstanding'
  }

  const submit = (): void => {
    /* Restated rather than read off `valid`, so the two figures below are
       narrowed to what the payment actually needs. */
    if (cents === null || cents <= 0 || day === null || record.isPending) return
    record.mutate(
      {
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        /* Today is recorded to the minute; a date typed back is local
           midnight of that day, which is all the field ever said. */
        paidAt: day === todayIso() ? new Date().toISOString() : atLocal(day, 0),
        amountCents: cents,
        method,
        note: note.trim() || null
      },
      { onSuccess: onRecorded }
    )
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
              <span className="money-field__symbol num">{symbol}</span>
              <input
                id="rp-amount"
                type="text"
                className="money-field__input num"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <span className="field-row__hint">
              Opens at the full {formatCents(outstanding, symbol)} outstanding. Change it for a part
              payment.
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
                  {methods.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
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
                {formatCents(invoice.totalCents, symbol)} invoiced
                {alreadyPaid > 0 ? ` · ${formatCents(alreadyPaid, symbol)} already received` : ''}
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
            disabled={!valid || record.isPending}
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
