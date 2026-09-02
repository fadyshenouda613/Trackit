/**
 * The status vocabulary, from the "Status pills" spec board:
 * "Two carry colour, four are neutral — colour marks money moving."
 *
 * Draft      dashed edge — nothing agreed yet, no figures
 * Active     accent tint — the only in-flight state
 * Delivered  warm — work done, money not asked for
 * Invoiced   neutral, brighter text — waiting on them
 * Paid       positive — the only fully closed state
 * Cancelled  recessive — the row dims; the pill carries the meaning
 *
 * Sent and Archived are not on the board; they come from the Clients artboard
 * and live here so every status chip in the app resolves in one place.
 *
 * Partially paid and Void come from the Invoices list, and both follow the rule
 * rather than bending it. Partially paid is warm because money has been asked
 * for and only some of it has arrived — the same register Delivered uses for
 * work that is done and unpaid. Void is recessive, like Cancelled: the row dims
 * and the pill says why. Neither is a stage of the other four.
 *
 * Being overdue is deliberately not in this list. It is a fact about a due date,
 * not a state of the invoice, so it is drawn on the date cell instead — see
 * overdueToneOf in invoices-data.ts.
 */
export type Status =
  | 'draft'
  | 'active'
  | 'delivered'
  | 'invoiced'
  | 'paid'
  | 'cancelled'
  | 'sent'
  | 'archived'
  | 'partial'
  | 'void'

type StatusStyle = {
  label: string
  background: string
  color: string
  border?: string
}

export const statusStyles: Record<Status, StatusStyle> = {
  draft: {
    label: 'Draft',
    background: 'var(--bg-overlay)',
    color: 'var(--status-draft-text)',
    border: '1px dashed var(--status-draft-line)'
  },
  active: {
    label: 'Active',
    background: 'var(--accent-surface)',
    color: 'var(--status-active-text)'
  },
  delivered: {
    label: 'Delivered',
    background: 'var(--warning-surface)',
    color: 'var(--status-delivered-text)'
  },
  invoiced: {
    label: 'Invoiced',
    background: 'var(--neutral-surface)',
    color: 'var(--status-invoiced-text)'
  },
  paid: {
    label: 'Paid',
    background: 'var(--positive-surface)',
    color: 'var(--status-paid-text)'
  },
  cancelled: {
    label: 'Cancelled',
    background: 'var(--bg-overlay)',
    color: 'var(--status-cancelled-text)'
  },
  sent: {
    label: 'Sent',
    background: 'var(--accent-surface)',
    color: 'var(--accent-text)'
  },
  archived: {
    label: 'Archived',
    background: 'var(--neutral-surface)',
    color: 'var(--neutral-text)'
  },
  partial: {
    label: 'Partially paid',
    background: 'var(--warning-surface)',
    color: 'var(--status-partial-text)'
  },
  void: {
    label: 'Void',
    background: 'var(--bg-overlay)',
    color: 'var(--status-void-text)'
  }
}
