import type { ErrorRequestHandler, RequestHandler } from 'express'
import { z } from 'zod'

/*
 * One shape for every failure the server sends:
 *
 *   { error: { code, message, details? } }
 *
 * `code` is a closed set the desktop folds into its own ApiErrorCode, so a
 * card can decide what to say without parsing prose. `details` is only ever
 * the field-level issues of a validation failure. A stack trace is never on
 * the wire; in production even the message of an unexpected error is not.
 *
 * `upgrade_required` (426) is the one code that is not about the request
 * but about the client: it speaks a sync protocol version this server does
 * not.
 */

export type ErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'conflict'
  | 'not_found'
  | 'rate_limited'
  | 'upgrade_required'
  | 'internal'

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export type ErrorBody = { error: { code: ErrorCode; message: string; details?: unknown } }

export const errorBody = (code: ErrorCode, message: string, details?: unknown): ErrorBody =>
  details === undefined ? { error: { code, message } } : { error: { code, message, details } }

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(errorBody('not_found', `No route for ${req.method} ${req.path}`))
}

export type ErrorHandlerOptions = {
  /** Whether an unexpected error's own message may be sent. Never in production. */
  exposeInternal: boolean
  log: (message: string, error: unknown) => void
}

/** The body parser's own failures, which arrive as errors with a `type`. */
const bodyParserFailure = (error: unknown): { status: number; message: string } | null => {
  if (typeof error !== 'object' || error === null || !('type' in error)) return null
  const type = (error as { type: unknown }).type
  if (type === 'entity.parse.failed') return { status: 400, message: 'The request body is not valid JSON' }
  if (type === 'entity.too.large') return { status: 413, message: 'The request body is too large' }
  return null
}

export function errorHandler(options: ErrorHandlerOptions): ErrorRequestHandler {
  // Express identifies an error handler by its arity, so `next` stays even though it is not used.
  return (error: unknown, _req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.status).json(errorBody(error.code, error.message, error.details))
      return
    }

    if (error instanceof z.ZodError) {
      const details = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      res.status(400).json(errorBody('validation', 'The request did not match what this route accepts', details))
      return
    }

    const parse = bodyParserFailure(error)
    if (parse) {
      res.status(parse.status).json(errorBody('validation', parse.message))
      return
    }

    options.log('Unhandled error', error)
    const message =
      options.exposeInternal && error instanceof Error ? error.message : 'Something went wrong'
    res.status(500).json(errorBody('internal', message))
  }
}
