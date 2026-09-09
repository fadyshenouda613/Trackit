import { z } from 'zod'
import { loginInputSchema, registerInputSchema } from '@trackit/shared/schemas'
import type { AuthService } from './auth/service'
import { handle } from './data-ipc'

/**
 * The account channels. `auth:changed` goes the other way, pushed from
 * index.ts whenever the status moves, so the renderer never polls.
 */
export function registerAuthIpc(auth: AuthService): void {
  handle('auth:status', z.undefined(), () => auth.status())
  handle('auth:register', registerInputSchema, (input) => auth.register(input))
  handle('auth:login', loginInputSchema, (input) => auth.login(input))
  handle('auth:logout', z.undefined(), async () => {
    await auth.logout()
    return null
  })
}
