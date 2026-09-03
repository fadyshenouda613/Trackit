/*
 * Between an entity and a row.
 *
 * Column names are the schema's field names in snake_case, so nothing here
 * has to be told a mapping. SQLite has no boolean, so `true`/`false` travel as
 * 1/0 and each table says which of its columns are booleans. Every read goes
 * back through the entity's Zod schema, which is what turns "a row" into "an
 * entity the rest of the app can trust".
 */

export type Row = Record<string, unknown>

export const snakeCase = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

export const camelCase = (key: string): string =>
  key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

/** An entity's fields as columns. `undefined` fields are left out, not written as NULL. */
export function toColumns(entity: Record<string, unknown>): Row {
  const row: Row = {}
  for (const [key, value] of Object.entries(entity)) {
    if (value === undefined) continue
    row[snakeCase(key)] = typeof value === 'boolean' ? (value ? 1 : 0) : value
  }
  return row
}

/** A row's columns as fields, with the named booleans restored. */
export function fromColumns(row: Row, booleans: ReadonlySet<string>): Record<string, unknown> {
  const entity: Record<string, unknown> = {}
  for (const [column, value] of Object.entries(row)) {
    const key = camelCase(column)
    entity[key] = booleans.has(key) ? value === 1 : value
  }
  return entity
}
