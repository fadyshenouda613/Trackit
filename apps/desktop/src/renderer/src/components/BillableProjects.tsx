import type { JSX } from 'react'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import type { BillableView } from './invoices-data'
import { formatCents, type Id, type Project } from '@trackit/shared'

type BillableProjectsProps = {
  view: BillableView
  /** Project ids already on the invoice, read back off the lines. */
  selected: Id[]
  /** The client currency symbol — a total in dollars under a GBP client is wrong. */
  symbol: string
  onToggle: (project: Project) => void
  onOpenProjects: () => void
}

/**
 * What this client is owed for, and nothing else.
 *
 * Work that has already gone out on an invoice stays in the list, dimmed. It is
 * the same treatment a cancelled project gets in the Projects table, and for the
 * same reason: a row that disappears reads as something lost, while a row that
 * dims reads as something accounted for. It is also the answer to "didn't I
 * already bill that?", which is the question this screen exists to settle.
 */
export function BillableProjects({
  view,
  selected,
  symbol,
  onToggle,
  onOpenProjects
}: BillableProjectsProps): JSX.Element {
  const billable = view.billable
  const invoiced = view.rows.length - billable.length

  /*
   * Two different absences, and they need two different sentences. Nothing
   * delivered at all is a prompt to go and deliver something; everything
   * delivered already billed is a reassurance, and keeps its evidence on screen.
   */
  const nothingDelivered = view.rows.length === 0
  const allInvoiced = !nothingDelivered && billable.length === 0
  const last = view.rows[0]

  return (
    <section className="panel billable" aria-label="Delivered work">
      <div className="billable__head">
        <h3 className="section__title">Delivered, not yet invoiced</h3>
        <span className="section__count num">
          {billable.length === 0
            ? 'None'
            : `${selected.length} of ${billable.length} selected`}
        </span>
      </div>

      {(nothingDelivered || allInvoiced) && (
        <EmptyState
          variant="panel"
          title={
            nothingDelivered
              ? `Nothing to bill for ${view.company}`
              : `Everything delivered for ${view.company} is already invoiced`
          }
          body={
            nothingDelivered ? (
              <>
                An invoice is built from projects marked <strong>delivered</strong>.{' '}
                {view.openProjects === 0
                  ? `${view.company} has no projects on the go.`
                  : `${view.company} has ${view.openProjects === 1 ? 'one project' : `${view.openProjects} projects`} on the go and ${view.openProjects === 1 ? 'it has not been' : 'none has been'} delivered yet.`}{' '}
                Mark the work delivered and it will appear here.
              </>
            ) : (
              <>
                The last one went out on {last.delivered}. Deliver more work and it will appear
                here.
              </>
            )
          }
          action={{ label: `Open ${view.company}’s projects`, onClick: onOpenProjects }}
          aside="or add a line by hand below"
        />
      )}

      {view.rows.length > 0 && (
        <>
          <div className="billable__header t-overline">
            <span />
            <span>Project</span>
            <span className="align-right">Delivered</span>
            <span className="align-right billable__price">Price</span>
            <span />
          </div>

          {view.rows.map((row) => {
            const project = row.project

            if (row.invoicedOn) {
              return (
                <div className="billable__row billable__row--dim" key={project.id}>
                  <span />
                  <span className="billable__name">
                    <span className="truncate">{project.name}</span>
                    <span className="billable__flag">already invoiced · {row.invoicedOn}</span>
                  </span>
                  <span className="align-right billable__date num">{row.delivered}</span>
                  <span className="align-right billable__price num">
                    {formatCents(project.priceCents, symbol)}
                  </span>
                  <span />
                </div>
              )
            }

            const on = selected.includes(project.id)

            return (
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                key={project.id}
                className={on ? 'billable__row billable__row--on' : 'billable__row'}
                onClick={() => onToggle(project)}
              >
                <span className="billable__box" aria-hidden="true">
                  {on && <Icon name="check" size={11} />}
                </span>
                <span className="billable__name">
                  <span className="truncate">{project.name}</span>
                </span>
                <span className="align-right billable__date num">{row.delivered}</span>
                <span className="align-right billable__price num">
                  {formatCents(project.priceCents, symbol)}
                </span>
                <span />
              </button>
            )
          })}
        </>
      )}

      {invoiced > 0 && billable.length > 0 && (
        <p className="billable__foot">
          {invoiced === 1 ? 'One project is' : `${invoiced} projects are`} already on an invoice and
          cannot be billed twice.
        </p>
      )}
    </section>
  )
}
