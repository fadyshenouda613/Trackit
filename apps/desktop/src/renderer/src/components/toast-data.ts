import { formatDuration, formatMoney } from '@trackit/shared'
import type { Tone } from './tone'

/**
 * The four things the app finishes doing that are worth a word afterwards.
 *
 * A toast earns its place only when the result happens somewhere you are not
 * looking. Marking a project delivered changes a pill you are staring at, so
 * that one is nearly redundant — it is here because the useful part is the
 * offer that follows it, not the confirmation. Stopping a timer is the
 * opposite: the bar vanishes, and without this the hours you just logged are
 * never stated anywhere you would see them.
 *
 * Every one of them carries the figure, never just the verb. "Payment
 * recorded" tells you the click landed; "Payment of $2,400.00 recorded" tells
 * you it landed on the right number, which is the only thing you were actually
 * checking.
 */

export type ToastKind = 'pdf' | 'payment' | 'delivered' | 'timer' | 'error'

export type Toast = {
  id: number
  kind: ToastKind
  tone: Tone
  message: string
  /** Omitted when there is nothing sensible to do next. */
  action?: string
}

/**
 * Only the payment takes colour.
 *
 * The design system reserves colour for money moving, and of these four only
 * one is money moving. A PDF that saved, a project that advanced and a timer
 * that stopped are all just things that worked, and a wall of green ticks
 * would spend the app's whole colour vocabulary on the least interesting news
 * it has.
 */
let nextId = 0

const make = (kind: ToastKind, tone: Tone, message: string, action?: string): Toast => ({
  id: (nextId += 1),
  kind,
  tone,
  message,
  action
})

export const pdfToast = (number: string): Toast =>
  make('pdf', 'neutral', `Invoice ${number} saved as PDF`, 'Show in folder')

export const paymentToast = (amount: number, number: string): Toast =>
  make('payment', 'positive', `${formatMoney(amount)} recorded against ${number}`, 'View invoice')

export const deliveredToast = (project: string): Toast =>
  make('delivered', 'neutral', `${project} marked delivered`, 'Create invoice')

/**
 * The one toast that reports a quantity you cannot otherwise check: the timer
 * bar is gone by the time this appears, taking the elapsed clock with it.
 */
export const timerToast = (minutes: number, project: string): Toast =>
  make('timer', 'neutral', `${formatDuration(minutes)} logged to ${project}`, 'Undo')

/**
 * The one negative toast. A write the store refused is news you were not
 * looking at — the form has already closed — so it is said here, in the
 * store's own words, with no action: there is nothing to undo.
 */
export const errorToast = (message: string): Toast => make('error', 'negative', message)
