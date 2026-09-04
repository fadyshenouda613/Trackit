import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { entryMinutes, hoursToMinutes } from '@trackit/shared/helpers'
import type { TimeEntry } from '@trackit/shared/schemas'
import { handle } from './data-ipc'
import type { Database } from './db'
import * as repo from './repositories'
import { seedDatabase } from './seed/seed'
import { wipeDatabase } from './seed/wipe'

/*
 * The States panel's levers, registered only in development. Each stages a
 * condition the app cannot reach through its own navigation — an empty
 * account, the fixtures, a clock running past its budget, a clock left running
 * overnight — by writing the rows that condition consists of.
 */

const scenarioSchema = z.enum(['running', 'over', 'orphaned'])

/** The project a scenario starts on: the sample by name, or one already over budget. */
function projectFor(db: Database, scenario: z.infer<typeof scenarioSchema>): string {
  const projects = repo.listProjects(db, { status: ['active', 'delivered'] })
  if (projects.length === 0) throw new repo.RepositoryError('invalid_state', 'Seed the database first')

  if (scenario === 'over') {
    const over = projects.find((project) => {
      const logged = repo.listTimeEntries(db, { projectId: project.id })
        .reduce((sum, entry) => sum + entryMinutes(entry), 0)
      return logged > hoursToMinutes(project.budgetedHours)
    })
    if (!over) throw new repo.RepositoryError('invalid_state', 'No project is over budget')
    return over.id
  }

  return (projects.find((project) => project.name === 'Brand refresh') ?? projects[0]).id
}

function stageTimer(db: Database, scenario: z.infer<typeof scenarioSchema>): TimeEntry {
  if (repo.runningTimeEntry(db)) repo.stopTimer(db)
  const projectId = projectFor(db, scenario)
  const input = { id: randomUUID(), projectId, checklistItemId: null, note: '' }
  if (scenario !== 'orphaned') return repo.startTimer(db, input)
  // 4:10 PM yesterday, local, the run the dialog was designed around.
  const started = new Date()
  started.setDate(started.getDate() - 1)
  started.setHours(16, 10, 0, 0)
  return repo.startTimer(db, input, started.toISOString())
}

export function registerDevIpc(db: Database, deps: { onTimerChanged: () => void }): void {
  handle('dev:reset', z.undefined(), () => {
    wipeDatabase(db)
    return null
  }, deps.onTimerChanged)

  handle(
    'dev:seed',
    z.object({ reset: z.boolean().default(false) }).optional(),
    (options) => {
      if (options?.reset) wipeDatabase(db)
      if (repo.listClients(db).length > 0) {
        throw new repo.RepositoryError('invalid_state', 'The database already has data; reset first')
      }
      return seedDatabase(db)
    },
    deps.onTimerChanged
  )

  handle('dev:timerScenario', scenarioSchema, (scenario) => stageTimer(db, scenario), deps.onTimerChanged)
}
