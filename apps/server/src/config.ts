import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

/*
 * Everything the server is told from outside, read once and checked once.
 * A missing or malformed value is a refusal to start with the field named,
 * not a stack trace from wherever it was first used.
 *
 * .env is for development and the tests; a real deployment sets the
 * variables itself. dotenv never overrides a variable that is already set,
 * so an exported value always wins over the file.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Signs the access tokens. Anything shorter is a secret in name only. */
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  /**
   * How long a machine may stay away before it has to sign in again. Every
   * refresh extends it, so this is the longest offline stretch a session
   * survives, not the life of an account.
   */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(90),
  /** Comma-separated browser origins. Empty allows none — the desktop is not a browser. */
  CORS_ORIGINS: z.string().default(''),
  /** 1 behind Railway, Render or any proxy that sets X-Forwarded-For. */
  TRUST_PROXY: z.enum(['0', '1']).default('0'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  /** Rows per page of POST /sync. A client loops while the server says there is more. */
  SYNC_PAGE_SIZE: z.coerce.number().int().positive().default(500),
  /** The most a sync body may weigh; a settings logo is a data URL. */
  SYNC_BODY_LIMIT: z.string().default('8mb'),
  /**
   * Comma-separated flags for the browser that prints PDFs. Empty on a
   * machine with a sandbox; `--no-sandbox,--disable-setuid-sandbox` in a
   * container without one (the Dockerfile sets it).
   */
  PDF_BROWSER_ARGS: z.string().default('')
})

export type Config = {
  env: 'development' | 'test' | 'production'
  port: number
  databaseUrl: string
  jwtSecret: string
  accessTokenTtlSeconds: number
  refreshTokenTtlDays: number
  corsOrigins: string[]
  trustProxy: boolean
  authRateLimit: { max: number; windowMs: number }
  syncPageSize: number
  syncBodyLimit: string
  pdfBrowserArgs: string[]
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Reads the configuration from an environment. Throws ConfigError with every problem named. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    throw new ConfigError(`Configuration is incomplete:\n${z.prettifyError(parsed.error)}`)
  }
  const raw = parsed.data
  return {
    env: raw.NODE_ENV,
    port: raw.PORT,
    databaseUrl: raw.DATABASE_URL,
    jwtSecret: raw.JWT_SECRET,
    accessTokenTtlSeconds: raw.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: raw.REFRESH_TOKEN_TTL_DAYS,
    corsOrigins: raw.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
    trustProxy: raw.TRUST_PROXY === '1',
    authRateLimit: {
      max: raw.AUTH_RATE_LIMIT_MAX,
      windowMs: raw.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000
    },
    syncPageSize: raw.SYNC_PAGE_SIZE,
    syncBodyLimit: raw.SYNC_BODY_LIMIT,
    pdfBrowserArgs: raw.PDF_BROWSER_ARGS.split(',')
      .map((flag) => flag.trim())
      .filter((flag) => flag !== '')
  }
}

/** Loads .env from the working directory (quietly) and then the configuration. */
export function loadConfigFromEnvFile(): Config {
  loadDotenv({ quiet: true })
  return loadConfig()
}
