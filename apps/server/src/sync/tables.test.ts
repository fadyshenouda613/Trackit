import { describe, expect, it } from 'vitest'
import { pgTimestampToIso, wireColumns, syncTables } from './tables'

describe('pgTimestampToIso', () => {
  it('reads the text form pg hands back, with and without fractions', () => {
    expect(pgTimestampToIso('2026-09-10 09:00:00+00')).toBe('2026-09-10T09:00:00.000Z')
    expect(pgTimestampToIso('2026-09-10 09:00:00.5+00')).toBe('2026-09-10T09:00:00.500Z')
    expect(pgTimestampToIso('2026-09-10 09:00:00.123456+00')).toBe('2026-09-10T09:00:00.123Z')
    expect(pgTimestampToIso('2026-09-10 11:00:00.25+02:00')).toBe('2026-09-10T09:00:00.250Z')
    expect(pgTimestampToIso(new Date('2026-09-10T09:00:00.007Z'))).toBe('2026-09-10T09:00:00.007Z')
  })

  it('refuses anything else rather than guessing', () => {
    expect(() => pgTimestampToIso('yesterday')).toThrow()
    expect(() => pgTimestampToIso(12)).toThrow()
  })
})

describe('wireColumns', () => {
  it('leaves the server’s own columns out', () => {
    const fields = wireColumns(syncTables.clients).map((info) => info.field)
    expect(fields).not.toContain('userId')
    expect(fields).not.toContain('serverSeq')
    expect(fields).not.toContain('updatedBy')
    expect(fields).toContain('createdAt')
  })
})
