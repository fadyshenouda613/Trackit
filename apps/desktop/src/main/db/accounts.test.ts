import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listClients } from '../repositories/clients'
import { aClient } from '../repositories/test-support'
import { accountUserId, setAccountUserId } from '../sync/meta'
import { openDatabase, type Database } from './index'
import { databaseFileFor, LOCAL_DATABASE, openAccountDatabase } from './accounts'

const ALEX = '00000000-0000-4000-8000-00000000000a'
const SAM = '00000000-0000-4000-8000-00000000000b'

let directory: string
const open: Database[] = []

/** Every connection a test opens, closed before its directory goes. */
const track = (db: Database): Database => {
  open.push(db)
  return db
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'trackit-accounts-'))
})

afterEach(() => {
  for (const db of open.splice(0)) if (db.open) db.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('databaseFileFor', () => {
  it('is the local file when signed out and a file named after the user when signed in', () => {
    expect(basename(databaseFileFor(directory, null))).toBe(LOCAL_DATABASE)
    expect(basename(databaseFileFor(directory, ALEX))).toBe(`trackit-${ALEX}.db`)
  })
})

describe('openAccountDatabase', () => {
  it('opens the local file when signed out, and does not stamp it', () => {
    const db = track(openAccountDatabase(directory, null))
    expect(basename(db.name)).toBe(LOCAL_DATABASE)
    expect(accountUserId(db)).toBeNull()
  })

  it('gives an account with no file a fresh one, stamped with the account', () => {
    const db = track(openAccountDatabase(directory, ALEX))
    expect(db.name).toBe(databaseFileFor(directory, ALEX))
    expect(accountUserId(db)).toBe(ALEX)
    expect(listClients(db)).toHaveLength(0)
  })

  it('adopts an unstamped local file for the first account to sign in', () => {
    const local = openDatabase(databaseFileFor(directory, null))
    const client = aClient(local)
    local.close()

    const db = track(openAccountDatabase(directory, ALEX))
    expect(db.name).toBe(databaseFileFor(directory, ALEX))
    expect(accountUserId(db)).toBe(ALEX)
    expect(listClients(db).map((row) => row.id)).toEqual([client.id])
    expect(existsSync(databaseFileFor(directory, null))).toBe(false)
  })

  it('adopts a local file already stamped with the same account', () => {
    const local = openDatabase(databaseFileFor(directory, null))
    setAccountUserId(local, ALEX)
    const client = aClient(local)
    local.close()

    const db = track(openAccountDatabase(directory, ALEX))
    expect(listClients(db).map((row) => row.id)).toEqual([client.id])
    expect(existsSync(databaseFileFor(directory, null))).toBe(false)
  })

  it("leaves a local file stamped with another account alone", () => {
    const local = openDatabase(databaseFileFor(directory, null))
    setAccountUserId(local, ALEX)
    aClient(local)
    local.close()

    const db = track(openAccountDatabase(directory, SAM))
    expect(db.name).toBe(databaseFileFor(directory, SAM))
    expect(accountUserId(db)).toBe(SAM)
    expect(listClients(db)).toHaveLength(0)
    expect(existsSync(databaseFileFor(directory, null))).toBe(true)

    const alex = track(openAccountDatabase(directory, ALEX))
    expect(listClients(alex)).toHaveLength(1)
  })

  it('opens an account file that exists as it is, whatever the local file holds', () => {
    const own = openDatabase(databaseFileFor(directory, ALEX))
    setAccountUserId(own, ALEX)
    const client = aClient(own)
    own.close()
    const local = openDatabase(databaseFileFor(directory, null))
    aClient(local)
    local.close()

    const db = track(openAccountDatabase(directory, ALEX))
    expect(listClients(db).map((row) => row.id)).toEqual([client.id])
    expect(existsSync(databaseFileFor(directory, null))).toBe(true)
  })

  it('opening the local file again after an adoption starts a fresh one', () => {
    const local = openDatabase(databaseFileFor(directory, null))
    aClient(local)
    local.close()
    track(openAccountDatabase(directory, ALEX))

    const again = track(openAccountDatabase(directory, null))
    expect(listClients(again)).toHaveLength(0)
    expect(accountUserId(again)).toBeNull()
  })
})
