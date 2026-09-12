/**
 * What the printed invoice says that is neither a stored field nor a
 * figure: the terms as a label and as a sentence, the bank block, and the
 * grouping of lines under the projects they were ticked from. The desktop's
 * sheet and the server's PDF both read from here, so the document a client
 * receives says the same thing whichever of the two made it.
 */
import { bySortOrder } from './sort-order'

/** "Net 14", "Due on receipt" — the terms as the date block states them. */
export const termsLabel = (days: number): string => (days === 0 ? 'Due on receipt' : `Net ${days}`)

/**
 * The terms, said in full. The date block already states them as a label;
 * this is the paragraph underneath it, written from the client's own
 * payment terms so the two can never disagree.
 */
export const paymentTermsProse = (days: number): string =>
  (days === 0
    ? 'Payment is due on receipt of this invoice.'
    : `Payment is due within ${days} days of the issue date.`) +
  ' Interest of 1.5% per month applies to balances outstanding after 30 days.'

/*
 * Where the money goes. No schema carries a bank account — nothing else in
 * the app has ever needed one — so it is a constant beside the one document
 * that prints it.
 */
export const bank = {
  name: 'Pacific Union Bank',
  account: 'Trackit Studio LLC',
  routing: '121000248',
  number: '4471 0092 3318',
  swift: 'PUBKUS6S'
} as const

export type InvoiceLineGroup<L> = { key: string; project: string; lines: L[]; totalCents: number }

/** A line as the grouping needs it: which project it was ticked from, and what it comes to. */
type GroupableLine = { id: string; projectId: string | null; amountCents: number; sortOrder: number }

/**
 * Lines grouped by the project they were ticked from, in line order, each
 * group summed; lines typed by hand form one group called "Other". The
 * group name is the project's — a line snapshots its label, but what the
 * group is called is what the project is called now.
 */
export function groupInvoiceLines<L extends GroupableLine>(
  lines: L[],
  projectName: (projectId: string) => string | undefined
): InvoiceLineGroup<L>[] {
  const groups = new Map<string, InvoiceLineGroup<L>>()
  for (const line of [...lines].sort(bySortOrder)) {
    const key = line.projectId ?? 'manual'
    const group = groups.get(key) ?? {
      key,
      project: (line.projectId === null ? undefined : projectName(line.projectId)) ?? 'Other',
      lines: [],
      totalCents: 0
    }
    group.lines.push(line)
    group.totalCents += line.amountCents
    groups.set(key, group)
  }
  return [...groups.values()]
}
