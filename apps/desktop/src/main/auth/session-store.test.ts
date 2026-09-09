import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSessionStore, plainCipher, type Cipher, type StoredSession } from './session-store'

const user = {
  id: '4f1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  email: 'alex@trackit.studio',
  name: 'Alex Marchetti',
  createdAt: '2026-08-28T09:15:00.000Z'
}
const session: StoredSession = { user, refreshToken: 'the-refresh-token', refreshExpiresAt: '2026-12-07T09:15:00.000Z' }

/** Reverses the bytes: enough to prove the file never holds the token as typed. */
const reversing: Cipher = {
  available: () => true,
  encrypt: (plain) => Buffer.from(Array.from(Buffer.from(plain, 'utf8')).reverse()),
  decrypt: (blob) => Buffer.from(Array.from(blob).reverse()).toString('utf8')
}

let dir: string
let file: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trackit-session-'))
  file = join(dir, 'nested', 'session.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('session store', () => {
  it('starts empty, then round-trips a session', () => {
    const store = createSessionStore(file, reversing)
    expect(store.read()).toBeNull()
    store.write(session)
    expect(store.read()).toEqual(session)
    store.clear()
    expect(store.read()).toBeNull()
    /* Clearing twice is fine. */
    store.clear()
  })

  it('keeps the token encrypted on disk when the OS offers it', () => {
    createSessionStore(file, reversing).write(session)
    const onDisk = JSON.parse(readFileSync(file, 'utf8'))
    expect(onDisk.encrypted).toBe(true)
    expect(onDisk.refreshToken).not.toBe(session.refreshToken)
    expect(readFileSync(file, 'utf8')).not.toContain(session.refreshToken)
    /* The user is in the clear: Settings has to name them before any decryption. */
    expect(onDisk.user).toEqual(user)
  })

  it('falls back to the clear, and says so, when the OS offers nothing', () => {
    const said: string[] = []
    const store = createSessionStore(file, plainCipher, (message) => said.push(message))
    store.write(session)
    expect(JSON.parse(readFileSync(file, 'utf8')).encrypted).toBe(false)
    expect(said.join(' ')).toContain('in the clear')
    expect(store.read()).toEqual(session)
  })

  it('treats a token it can no longer decrypt as no session', () => {
    createSessionStore(file, reversing).write(session)
    const broken: Cipher = {
      ...reversing,
      decrypt: () => {
        throw new Error('key changed')
      }
    }
    const said: string[] = []
    expect(createSessionStore(file, broken, (message) => said.push(message)).read()).toBeNull()
    expect(said.join(' ')).toContain('cannot be decrypted')
  })

  it('treats a file it cannot read as no session rather than crashing', () => {
    const store = createSessionStore(file, reversing)
    store.write(session)
    writeFileSync(file, 'not json')
    expect(store.read()).toBeNull()
    writeFileSync(file, JSON.stringify({ version: 2, user }))
    expect(store.read()).toBeNull()
    writeFileSync(file, JSON.stringify({ version: 1, user, encrypted: false, refreshToken: 't', refreshExpiresAt: 'yesterday' }))
    expect(store.read()).toBeNull()
  })
})
