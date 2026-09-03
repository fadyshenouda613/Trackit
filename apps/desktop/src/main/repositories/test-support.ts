import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type { Client, Project, ProjectStatus } from '@trackit/shared/schemas'
import { createClient } from './clients'
import { createProject, transitionProject } from './projects'

/*
 * What the repository tests build on: a client, and a project walked to the
 * status a test needs through the same transitions the app uses.
 */

export const id = (): string => randomUUID()

export function aClient(db: Database, overrides: Partial<Client> = {}): Client {
  return createClient(db, {
    id: id(),
    name: 'Priya Raghunathan',
    company: 'Northwind Studio',
    email: 'priya@northwindstudio.com',
    phone: '',
    address: '',
    currency: 'USD',
    paymentTermsDays: 14,
    notes: '',
    ...overrides
  })
}

export function aProject(
  db: Database,
  client: Client,
  status: Extract<ProjectStatus, 'draft' | 'active' | 'delivered'> = 'draft',
  overrides: Partial<Project> = {}
): Project {
  const project = createProject(db, {
    id: id(),
    clientId: client.id,
    name: 'Brand refresh',
    description: '',
    priceCents: 650000,
    currency: 'USD',
    budgetedHours: 32,
    status: 'draft',
    kickoffAt: null,
    dueAt: null,
    deliveredAt: null,
    ...overrides
  })
  if (status === 'draft') return project
  const active = transitionProject(db, project.id, 'active')
  return status === 'active' ? active : transitionProject(db, project.id, 'delivered')
}
