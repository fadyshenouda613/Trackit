import type { Database } from 'better-sqlite3'
import {
  projectSchema,
  type CreateProjectInput,
  type Project,
  type ProjectListFilters,
  type ProjectTransition,
  type UpdateProjectInput
} from '@trackit/shared/schemas'
import { nowIso } from '../db/clock'
import { RepositoryError } from './errors'
import {
  createRow,
  defineTable,
  getRow,
  requireRow,
  selectRows,
  softDeleteRow,
  updateRow
} from './table'

export const projectsTable = defineTable<Project>({
  name: 'projects',
  label: 'project',
  schema: projectSchema
})

/**
 * A project starts as a draft or, when the work has already begun, active.
 * `invoiced` and `paid` are what an invoice does to it, and `archived` is not
 * reachable yet, so neither can be asked for here.
 */
export function createProject(db: Database, input: CreateProjectInput): Project {
  if (input.status !== 'draft' && input.status !== 'active') {
    throw new RepositoryError(
      'invalid_state',
      `A project cannot be created as ${input.status}; that status follows from its invoice`
    )
  }
  const kickoffAt = input.status === 'active' ? (input.kickoffAt ?? nowIso()) : input.kickoffAt
  return createRow(db, projectsTable, { ...input, kickoffAt })
}

/** Everything but the status, which only moves along the graph below. */
export function updateProject(db: Database, id: string, patch: UpdateProjectInput): Project {
  if (patch.status !== undefined) {
    throw new RepositoryError('invalid_state', 'A status is not edited; it is transitioned')
  }
  return updateRow(db, projectsTable, id, patch)
}

export const deleteProject = (db: Database, id: string): Project =>
  softDeleteRow(db, projectsTable, id)

export const getProject = (db: Database, id: string): Project | null =>
  getRow(db, projectsTable, id)

/**
 * The status graph the screens imply:
 *
 *   draft → active        the kickoff; `kickoffAt` is set now if it was not
 *   active → delivered    the work is done; `deliveredAt` is set now
 *   anything → cancelled  the way out, from any state but cancelled itself
 *
 * `invoiced` and `paid` are derived from the invoice the project is on — see
 * sendInvoice, recordPayment and voidInvoice — and cannot be asked for.
 */
export function transitionProject(db: Database, id: string, to: ProjectTransition): Project {
  const project = requireRow(db, projectsTable, id)
  const from = project.status
  const refuse = (): never => {
    throw new RepositoryError('invalid_transition', `A ${from} project cannot be marked ${to}`)
  }

  switch (to) {
    case 'active':
      if (from !== 'draft') refuse()
      return updateRow(db, projectsTable, id, {
        status: 'active',
        kickoffAt: project.kickoffAt ?? nowIso()
      })
    case 'delivered':
      if (from !== 'active') refuse()
      return updateRow(db, projectsTable, id, { status: 'delivered', deliveredAt: nowIso() })
    case 'cancelled':
      if (from === 'cancelled') refuse()
      return updateRow(db, projectsTable, id, { status: 'cancelled' })
    default:
      // The schema stops anything else at the bridge; this stops it here.
      return refuse()
  }
}

/**
 * The Projects list: status and client filters, the search field, and the
 * four sorts on the toolbar. "Rate" is price over logged minutes, computed
 * here so the order agrees with the column, with unlogged projects last.
 */
export function listProjects(db: Database, filters: ProjectListFilters = {}): Project[] {
  const where = ['p.deleted_at IS NULL']
  const params: Record<string, unknown> = {}

  if (filters.status !== undefined) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    statuses.forEach((status, index) => {
      params[`status${index}`] = status
    })
    where.push(`p.status IN (${statuses.map((_, index) => `@status${index}`).join(', ')})`)
  }
  if (filters.clientId !== undefined) {
    where.push('p.client_id = @clientId')
    params['clientId'] = filters.clientId
  }
  if (filters.search) {
    where.push('lower(p.name) LIKE @search')
    params['search'] = `%${filters.search.toLowerCase()}%`
  }

  const orderBy = {
    recent: 'p.updated_at DESC, p.id',
    price: 'p.price_cents DESC, p.name',
    client: 'lower(c.company), lower(c.name), p.name',
    rate: `CASE WHEN COALESCE(t.minutes, 0) > 0 THEN p.price_cents * 1.0 / t.minutes ELSE -1 END DESC, p.name`
  }[filters.sort ?? 'recent']

  return selectRows(
    projectsTable,
    db.prepare(
      `SELECT p.*
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN (
         SELECT project_id,
                SUM((julianday(ended_at) - julianday(started_at)) * 1440) AS minutes
         FROM time_entries
         WHERE deleted_at IS NULL AND ended_at IS NOT NULL
         GROUP BY project_id
       ) t ON t.project_id = p.id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}`
    ),
    params
  )
}
