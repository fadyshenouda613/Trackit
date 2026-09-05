import type { JSX } from 'react'

/**
 * The shape of a table before its rows arrive.
 *
 * It renders the real table's own class names — `panel projects`,
 * `projects__header`, `projects__row` — and swaps only the cell contents for
 * bars. The columns are declared once in app.css as a custom property on the
 * block (`--projects-grid`), so borrowing the classes borrows the grid, and a
 * skeleton cannot drift out of alignment with the table it stands in for. The
 * alternative, restating the track list here, would be two places for the
 * column widths to disagree.
 *
 * Widths are varied and mostly short of their cell. A row of full-width blocks
 * reads as furniture; a row of ragged ones reads as writing you cannot make
 * out yet, which is what this is. The right-aligned figure columns keep their
 * alignment, so the money column still forms a straight edge down the table
 * and the layout does not visibly settle when the real rows land.
 */

type Cell = {
  /** Percentage of the cell. Under 100 always, so a gutter stays visible. */
  width: number
  align?: 'right'
  /** Renders the bare 3px rail instead of a bar, for the two meter columns. */
  meter?: boolean
  /**
   * Two bars stacked, for a cell the real table draws on two lines. It is what
   * makes the skeleton row the same height as the row it stands in for — the
   * dashboard's effective-rate cell is a figure over a note, and it alone sets
   * that table's row height.
   */
  stack?: boolean
  /**
   * A chip rather than a bar, for the status column. It is drawn with the real
   * .pill classes and a blank space inside, so it inherits that chip's padding
   * and line box — which is what makes these rows the height they really are,
   * the status cell being the tallest thing in them.
   */
  pill?: boolean
}

type Spec = {
  /** Row count that fills the space these tables usually occupy. */
  rows: number
  columns: Cell[]
}

/*
 * One entry per table, matching its header cell for cell. The dashboard's
 * seven columns and the projects screen's nine are different tables, as
 * app.css says: "A different table from the dashboard's".
 */
const specs = {
  projects: {
    rows: 6,
    columns: [
      { width: 74 },
      { width: 58 },
      { width: 52, align: 'right' },
      { width: 68, meter: true },
      { width: 44, align: 'right' },
      { width: 72, meter: true },
      { width: 62, align: 'right', stack: true }
    ]
  },
  'all-projects': {
    rows: 8,
    columns: [
      { width: 78 },
      { width: 60 },
      { width: 54, align: 'right' },
      { width: 62, pill: true },
      { width: 70, meter: true },
      { width: 46, align: 'right' },
      { width: 74, meter: true },
      { width: 56, align: 'right' },
      { width: 50, align: 'right' }
    ]
  },
  invoices: {
    rows: 7,
    columns: [
      { width: 62 },
      { width: 72 },
      { width: 56 },
      { width: 56 },
      { width: 52, align: 'right' },
      { width: 44, align: 'right' },
      { width: 58, pill: true }
    ]
  },
  clients: {
    rows: 8,
    columns: [
      { width: 74 },
      { width: 60 },
      { width: 40, align: 'right' },
      { width: 56, align: 'right' },
      { width: 52, align: 'right' },
      { width: 20 }
    ]
  },
  'time-log': {
    rows: 8,
    columns: [
      { width: 70 },
      { width: 56 },
      { width: 80 },
      { width: 44, align: 'right' },
      { width: 44, align: 'right' },
      { width: 40, align: 'right' },
      { width: 16 }
    ]
  }
} satisfies Record<string, Spec>

export type SkeletonBlock = keyof typeof specs

type TableSkeletonProps = {
  block: SkeletonBlock
  /** Overrides the preset when a screen has room for a different number. */
  rows?: number
}

export function TableSkeleton({ block, rows }: TableSkeletonProps): JSX.Element {
  const spec: Spec = specs[block]
  const count = rows ?? spec.rows

  return (
    /*
     * The pulse goes on the container, not the bars. Forty separately animated
     * elements would shimmer against each other; one breathing table reads as
     * a single thing that is busy. It also inherits the reduced-motion opt-out
     * that .pulse already carries, so this needs no rule of its own.
     */
    <div className={`panel ${block} pulse skeleton`} aria-busy="true" aria-hidden="true">
      <div className={`${block}__header skeleton__row`}>
        {spec.columns.map((cell, index) => (
          <span
            className="skeleton__bar skeleton__bar--head"
            key={index}
            style={{
              width: `${Math.min(cell.width, 54)}%`,
              marginLeft: cell.align === 'right' ? 'auto' : undefined
            }}
          />
        ))}
      </div>

      {Array.from({ length: count }, (_, row) => (
        <div className={`${block}__row skeleton__row`} key={row}>
          {spec.columns.map((cell, index) => {
            if (cell.meter) {
              /* The bare rail the tables already use for a project with no
                 percentage to show — the same shape, for the same reason. */
              return <div className="meter" key={index} />
            }

            /* Staggered by row so a column does not read as a stack of
               identical bars, which is the tell of a fake. */
            const width = `${Math.max(28, cell.width - ((row * 7) % 21))}%`
            const pushed = cell.align === 'right' ? 'auto' : undefined

            if (cell.pill) {
              return (
                <span key={index}>
                  <span className="pill pill--md skeleton__pill">&nbsp;</span>
                </span>
              )
            }

            if (cell.stack) {
              return (
                <div className="skeleton__stack" key={index}>
                  <span className="skeleton__bar" style={{ width, marginLeft: pushed }} />
                  <span
                    className="skeleton__bar skeleton__bar--note"
                    style={{ width: `${Math.round(Number(cell.width) * 0.8)}%`, marginLeft: pushed }}
                  />
                </div>
              )
            }

            return (
              <span
                className="skeleton__bar"
                key={index}
                style={{ width, marginLeft: pushed }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
