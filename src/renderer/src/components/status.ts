/**
 * The status vocabulary, from the "Status pills" spec board:
 * "Two carry colour, four are neutral — colour marks money moving."
 *
 * Draft      dashed edge — nothing agreed yet, no figures
 * Active     accent tint — the only in-flight state
 * Delivered  warm — work done, money not asked for
 * Invoiced   neutral, brighter text — waiting on them
 * Paid       positive — the only fully closed state
 * Cancelled  recessive — row dims, name struck through
 *
 * Sent and Archived are not on the board; they come from the Clients artboard
 * and live here so every status chip in the app resolves in one place.
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
  }
}
