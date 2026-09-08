/*
 * The repositories: plain functions over a database handle, one module per
 * entity. Nothing here imports Electron, so all of it runs under Vitest
 * against an in-memory database — see the tests beside each module.
 */
export * from './errors'
export * from './clients'
export * from './projects'
export * from './milestones'
export * from './checklist-items'
export * from './notes'
export * from './time-entries'
export * from './invoices'
export * from './settings'
export * from './sync'
