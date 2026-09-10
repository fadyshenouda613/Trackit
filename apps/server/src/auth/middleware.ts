import type { RequestHandler } from 'express'
import { AppError } from '../errors'
import { familyIsLive, type AuthDeps } from './service'
import { verifyAccessToken, type AccessClaims } from './tokens'

/*
 * Reads the bearer token and leaves the claims on `res.locals.auth` for the
 * route behind it. The family is checked too, so an access token issued to
 * a session that has since signed out stops working with it rather than
 * living out its last few minutes.
 */

export type AuthLocals = { auth: AccessClaims }

export const requireAuth =
  (deps: AuthDeps): RequestHandler =>
  async (req, res, next) => {
    const header = req.headers.authorization ?? ''
    const [scheme, token] = header.split(' ')
    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'unauthorized', 'A bearer token is required')
    }
    const claims = await verifyAccessToken(deps.jwtSecret, token)
    if (!claims || !(await familyIsLive(deps, claims.familyId))) {
      throw new AppError(401, 'unauthorized', 'This token is not valid')
    }
    ;(res.locals as AuthLocals).auth = claims
    next()
  }
