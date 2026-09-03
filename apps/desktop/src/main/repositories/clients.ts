import type { Database } from 'better-sqlite3'
import {
  clientSchema,
  type Client,
  type ClientListFilters,
  type CreateClientInput,
  type UpdateClientInput
} from '@trackit/shared/schemas'
import { createRow, defineTable, getRow, selectRows, softDeleteRow, updateRow } from './table'

export const clientsTable = defineTable<Client>({
  name: 'clients',
  label: 'client',
  schema: clientSchema
})

export const createClient = (db: Database, input: CreateClientInput): Client =>
  createRow(db, clientsTable, input)

export const updateClient = (db: Database, id: string, patch: UpdateClientInput): Client =>
  updateRow(db, clientsTable, id, patch)

export const deleteClient = (db: Database, id: string): Client => softDeleteRow(db, clientsTable, id)

export const getClient = (db: Database, id: string): Client | null => getRow(db, clientsTable, id)

/** Live clients in the order they were added, narrowed by the search field. */
export function listClients(db: Database, filters: ClientListFilters = {}): Client[] {
  const where = ['deleted_at IS NULL']
  const params: Record<string, unknown> = {}

  if (filters.search) {
    where.push('(lower(name) LIKE @search OR lower(company) LIKE @search)')
    params['search'] = `%${filters.search.toLowerCase()}%`
  }

  return selectRows(
    clientsTable,
    db.prepare(`SELECT * FROM clients WHERE ${where.join(' AND ')} ORDER BY created_at, id`),
    params
  )
}
