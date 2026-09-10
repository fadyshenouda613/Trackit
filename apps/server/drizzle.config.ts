import { defineConfig } from 'drizzle-kit'

/*
 * drizzle-kit generate reads src/db/schema.ts and writes the next numbered
 * migration into drizzle/. Migrations are never edited once written; a
 * schema change is a new file. The database URL is only needed by commands
 * that talk to one (push, studio), which this project does not use.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true
})
