import { useState, type JSX } from 'react'
import type { SyncConflict } from '@trackit/shared'
import { Notice } from './Notice'

/*
 * The two ways two machines can disagree, and what the app says about each.
 *
 * Both have already been resolved by the time you read them. Nothing here asks
 * you to choose — a dialog demanding you arbitrate a merge before you can get
 * to your invoices would be a far worse interruption than the conflict itself.
 * The app picks, says plainly what it picked, and leaves your own version
 * within reach for as long as the notice is up.
 *
 * They differ in register on purpose. A record edited twice may have lost you
 * something and is worth a look, so it is warm and carries a mark. A checklist
 * reordered twice lost nothing at all — only positions moved — so it is grey
 * and carries none. The app already makes this distinction: "Information, not
 * a warning" is why the timer recovery dialog has no tint either.
 *
 * The rule behind both: when the same row was changed here and elsewhere, the
 * later change wins everywhere. What lost is kept, and "Restore my version"
 * writes it back as a fresh change — which then wins everywhere in its turn.
 */

/** How a field is named to a person. Anything not listed is spelt out from its name. */
const fieldLabels: Record<string, string> = {
  name: 'name',
  company: 'company',
  email: 'email',
  phone: 'phone',
  address: 'address',
  currency: 'currency',
  paymentTermsDays: 'payment terms',
  notes: 'notes',
  description: 'description',
  priceCents: 'price',
  budgetedHours: 'budgeted hours',
  status: 'status',
  kickoffAt: 'kickoff date',
  dueAt: 'due date',
  deliveredAt: 'delivery date',
  label: 'label',
  done: 'done',
  sortOrder: 'position',
  body: 'text',
  pinned: 'pinned',
  startedAt: 'start',
  endedAt: 'end',
  note: 'note',
  number: 'number',
  taxRate: 'tax rate',
  amountCents: 'amount',
  paidAt: 'payment date',
  method: 'method',
  deletedAt: 'deletion',
  person: 'your name',
  businessName: 'business name',
  numberingScheme: 'numbering',
  rateFloorCents: 'rate floor',
  shortcut: 'shortcut'
}

const fieldLabel = (field: string): string =>
  fieldLabels[field] ?? field.replace(/([A-Z])/g, ' $1').toLowerCase()

/** "the price", "the price and the due date", "the price, the due date and 2 more". */
export function describeFields(fields: string[]): string {
  const named = fields.filter((field) => field !== 'deletedAt').map((field) => `the ${fieldLabel(field)}`)
  if (named.length === 0) return 'it'
  if (named.length === 1) return named[0]!
  if (named.length === 2) return `${named[0]} and ${named[1]}`
  if (named.length === 3) return `${named[0]}, ${named[1]} and ${named[2]}`
  return `${named[0]}, ${named[1]} and ${named.length - 2} more`
}

/** The sentence a record conflict states, from what happened on each side. */
export function recordConflictBody(conflict: SyncConflict): string {
  if (conflict.remoteDeletedAt !== null) {
    return `${conflict.label} was edited here and deleted on another device afterwards. The deletion was kept.`
  }
  if (conflict.localDeletedAt !== null) {
    return `You deleted ${conflict.label} here, but another device edited it afterwards, so it was kept.`
  }
  return `${describeFields(conflict.fields)} of ${conflict.label} changed here and on another device while this machine was offline. The other device’s version was kept.`.replace(
    /^the /,
    'The '
  )
}

/** What the States panel shows when it forces the notice with no real conflict behind it. */
export const sampleRecordConflict: SyncConflict = {
  id: '00000000-0000-4000-8000-00000000c0f1',
  table: 'projects',
  rowId: '00000000-0000-4000-8000-000000000002',
  kind: 'record',
  projectId: '00000000-0000-4000-8000-000000000002',
  label: 'Brand refresh',
  fields: ['dueAt', 'priceCents'],
  localDeletedAt: null,
  remoteDeletedAt: null,
  detectedAt: new Date().toISOString()
}

type RecordConflictNoticeProps = {
  conflict: SyncConflict
  /** Leave the other device's version in place. */
  onKeepTheirs: () => void
  /** Write this machine's version back, so it wins everywhere next. */
  onRestoreMine: () => void
}

/**
 * The same record, edited here and on another machine. The later edit won;
 * this notice says so, and offers the one thing you might still want.
 */
export function RecordConflictNotice({ conflict, onKeepTheirs, onRestoreMine }: RecordConflictNoticeProps): JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const restoreLabel = conflict.localDeletedAt !== null ? 'Delete it again' : 'Restore my version'

  return (
    <Notice
      tone="warning"
      icon="alert"
      title={conflict.remoteDeletedAt !== null ? 'Deleted on another device' : 'Edited on two devices'}
      /* Dismissing is keeping theirs: that is what the row already holds. */
      onDismiss={onKeepTheirs}
      actions={
        confirming ? (
          /* Two taps, not a dialog — the app's rule for anything that replaces
             work. What is on screen is the other device's version; putting
             yours back over it is worth a pause, not a second window. */
          <div className="inv-acts__confirm">
            <span className="inv-acts__confirm-text">
              The other device&rsquo;s version would be replaced, there as well as here.
            </span>
            <div className="inv-acts__confirm-row">
              <button type="button" className="button inv-acts__button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button inv-acts__button inv-acts__button--danger"
                onClick={() => {
                  setConfirming(false)
                  onRestoreMine()
                }}
              >
                {restoreLabel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button type="button" className="button notice__button" onClick={onKeepTheirs}>
              Keep the other version
            </button>
            <button type="button" className="button notice__button" onClick={() => setConfirming(true)}>
              {restoreLabel}
            </button>
          </>
        )
      }
    >
      {recordConflictBody(conflict)}
    </Notice>
  )
}

/** The States panel's sample: two items moved on both machines. */
export const sampleReorderConflicts: SyncConflict[] = ['Logo', 'Type specimen'].map((label, index) => ({
  id: `00000000-0000-4000-8000-00000000c0f${index + 2}`,
  table: 'checklist_items',
  rowId: `00000000-0000-4000-8000-00000000000${index + 5}`,
  kind: 'reorder',
  projectId: '00000000-0000-4000-8000-000000000002',
  label,
  fields: ['sortOrder'],
  localDeletedAt: null,
  remoteDeletedAt: null,
  detectedAt: new Date().toISOString()
}))

type ReorderConflictNoticeProps = {
  /** The lost moves on this checklist. */
  conflicts: SyncConflict[]
  onKeepTheirs: () => void
  onRestoreMine: () => void
}

/**
 * The same checklist, reordered in two places. Nothing was lost and nothing
 * needs deciding, so this states what happened and offers the one thing you
 * might still want — your own order back.
 */
export function ReorderConflictNotice({ conflicts, onKeepTheirs, onRestoreMine }: ReorderConflictNoticeProps): JSX.Element {
  const labels = conflicts.map((conflict) => conflict.label)
  const moved =
    labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? `${labels[0]} and ${labels[1]}`
        : `${labels.slice(0, 2).join(', ')} and ${labels.length - 2} more`

  return (
    <Notice
      title="Reordered in two places"
      onDismiss={onKeepTheirs}
      actions={
        <button type="button" className="button notice__button" onClick={onRestoreMine}>
          Restore my order
        </button>
      }
    >
      You moved {moved} here while another device moved {labels.length === 1 ? 'it' : 'them'} too. Moves of
      other items were kept from both sides; for {labels.length === 1 ? 'this one' : 'these'} the other
      device&rsquo;s position won.
    </Notice>
  )
}
