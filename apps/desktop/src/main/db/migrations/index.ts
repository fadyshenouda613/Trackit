import type { Migration } from '../migrate'

/*
 * Every .sql file in this directory, as text, in name order. Listing the
 * directory at build time means a new migration is picked up by being added
 * here — there is no register to forget to update.
 */
const files = import.meta.glob<string>('./*.sql', { query: '?raw', import: 'default', eager: true })

export const migrations: Migration[] = Object.entries(files)
  .map(([path, sql]) => ({ name: path.replace(/^.*\//, '').replace(/\.sql$/, ''), sql }))
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
