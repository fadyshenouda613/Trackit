/*
 * What the app knows about a newer version of itself. One value, read by the
 * update notice; the main process moves it as electron-updater reports in.
 *
 *   disabled     a development build; nothing is ever checked
 *   idle         nothing known, or this is the latest version
 *   checking     asking the release feed now
 *   downloading  a newer version is on its way down (Windows)
 *   ready        downloaded; restarting installs it (Windows)
 *   available    a newer version exists but cannot be installed in place, so
 *                the offer is the download page (macOS, where an unsigned
 *                build cannot be swapped by the updater)
 *   error        the last check or download failed; the app is unaffected
 */
import { z } from 'zod'

const version = z.string().trim().min(1)

export const updateStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('disabled'), reason: z.string() }),
  z.object({ state: z.literal('idle') }),
  z.object({ state: z.literal('checking') }),
  z.object({ state: z.literal('downloading'), version, percent: z.number().min(0).max(100) }),
  z.object({ state: z.literal('ready'), version }),
  z.object({ state: z.literal('available'), version, url: z.url() }),
  z.object({ state: z.literal('error'), message: z.string() })
])
export type UpdateStatus = z.infer<typeof updateStatusSchema>
