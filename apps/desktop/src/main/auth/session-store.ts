import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import { authUserSchema, timestampSchema, type AuthUser, type Timestamp } from '@trackit/shared/schemas'

/*
 * The one thing about an account this machine keeps: who is signed in and
 * the refresh token that proves it. It lives in a file in userData, beside
 * the database, because the session has to outlive the window — the app's
 * promise is that an account is needed once, and then it opens straight into
 * your work, connection or no connection.
 *
 * The token is encrypted with whatever the OS offers (Electron's safeStorage:
 * DPAPI on Windows, the Keychain on macOS, the secret service on Linux) and
 * stored base64'd. The cipher is handed in rather than imported so this file
 * has no Electron in it and is tested with a stand-in.
 */

export type Cipher = {
  /** Whether the OS is offering encryption at all right now. */
  available: () => boolean
  encrypt: (plain: string) => Buffer
  decrypt: (blob: Buffer) => string
}

export type StoredSession = {
  user: AuthUser
  refreshToken: string
  refreshExpiresAt: Timestamp
}

export type SessionStore = {
  /** The stored session, or null when there is none or it cannot be read. */
  read: () => StoredSession | null
  write: (session: StoredSession) => void
  clear: () => void
}

/**
 * The record on disk. `encrypted: false` is the fallback for a machine whose
 * OS offers no encryption — some Linux sessions without a secret service —
 * where a session that never survives a restart would be the worse failure.
 * It is logged when written so it is never a silent downgrade.
 */
const fileSchema = z.object({
  version: z.literal(1),
  user: authUserSchema,
  refreshExpiresAt: timestampSchema,
  encrypted: z.boolean(),
  /** The token: base64 of the cipher's output, or the token itself when not encrypted. */
  refreshToken: z.string().min(1)
})

export function createSessionStore(
  file: string,
  cipher: Cipher,
  log: (message: string) => void = () => undefined
): SessionStore {
  const read = (): StoredSession | null => {
    let raw: string
    try {
      raw = readFileSync(file, 'utf8')
    } catch {
      return null
    }
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      log('session file is not JSON; ignoring it')
      return null
    }
    const parsed = fileSchema.safeParse(json)
    if (!parsed.success) {
      /* A shape this build does not know is treated as no session rather
         than half-trusted. */
      log('session file has a shape this build cannot read; ignoring it')
      return null
    }
    const record = parsed.data
    let refreshToken: string
    if (record.encrypted) {
      try {
        refreshToken = cipher.decrypt(Buffer.from(record.refreshToken, 'base64'))
      } catch (error) {
        /* The OS key changed under us — a reinstalled OS, another user
           account. The session is gone; the data is not. */
        log(`session token cannot be decrypted (${error instanceof Error ? error.message : String(error)}); ignoring it`)
        return null
      }
    } else {
      refreshToken = record.refreshToken
    }
    return { user: record.user, refreshToken, refreshExpiresAt: record.refreshExpiresAt }
  }

  const write = (session: StoredSession): void => {
    const encrypted = cipher.available()
    if (!encrypted) log('the OS offers no encryption; storing the session token in the clear')
    const record: z.infer<typeof fileSchema> = {
      version: 1,
      user: session.user,
      refreshExpiresAt: session.refreshExpiresAt,
      encrypted,
      refreshToken: encrypted ? cipher.encrypt(session.refreshToken).toString('base64') : session.refreshToken
    }
    mkdirSync(dirname(file), { recursive: true })
    /* Written beside, then renamed over: a crash mid-write leaves the old
       session, not half a new one. */
    const temp = `${file}.tmp`
    writeFileSync(temp, JSON.stringify(record, null, 2), { encoding: 'utf8', mode: 0o600 })
    renameSync(temp, file)
  }

  const clear = (): void => {
    rmSync(file, { force: true })
  }

  return { read, write, clear }
}

/** A cipher that does nothing, for the tests and for a machine with none. */
export const plainCipher: Cipher = {
  available: () => false,
  encrypt: (plain) => Buffer.from(plain, 'utf8'),
  decrypt: (blob) => blob.toString('utf8')
}
