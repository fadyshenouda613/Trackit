import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  registerInputSchema
} from '@trackit/shared/schemas'
import { AppError } from '../errors'
import { requireAuth, type AuthLocals } from './middleware'
import { login, logout, refresh, register, userById, type AuthDeps } from './service'

/*
 * The account routes. Each handler is the same three lines the desktop's IPC
 * handlers are: parse the body with the shared schema, call the plain
 * function, send what it returned. A body that fails its schema throws a
 * ZodError, which the error handler turns into a 400 with the fields named.
 */

export type AuthRouterOptions = {
  deps: AuthDeps
  rateLimit: { max: number; windowMs: number }
}

export function authRouter(options: AuthRouterOptions): Router {
  const { deps } = options
  const router = Router()

  /*
   * Per address, on the three routes that take a credential. The answer on
   * the way over the line is the same shape as every other refusal, so a
   * client reads `rate_limited` rather than parsing the limiter's own text.
   */
  const limiter = rateLimit({
    windowMs: options.rateLimit.windowMs,
    limit: options.rateLimit.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(429, 'rate_limited', 'Too many attempts from this address; try again later'))
  })

  router.post('/register', limiter, async (req, res) => {
    const session = await register(deps, registerInputSchema.parse(req.body))
    res.status(201).json(session)
  })

  router.post('/login', limiter, async (req, res) => {
    const session = await login(deps, loginInputSchema.parse(req.body))
    res.json(session)
  })

  router.post('/refresh', limiter, async (req, res) => {
    const session = await refresh(deps, refreshInputSchema.parse(req.body).refreshToken)
    res.json(session)
  })

  router.post('/logout', async (req, res) => {
    await logout(deps, logoutInputSchema.parse(req.body).refreshToken)
    res.status(204).end()
  })

  router.get('/me', requireAuth(deps), async (_req, res) => {
    const { auth } = res.locals as AuthLocals
    const user = await userById(deps, auth.userId)
    if (!user) throw new AppError(401, 'unauthorized', 'This token is not valid')
    res.json({ user })
  })

  return router
}
