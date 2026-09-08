import { describe, expect, it } from 'vitest'
import { nextUpdateStatus, type UpdateEvent } from './update-status'
import type { UpdateStatus } from '@trackit/shared/schemas'

const run = (start: UpdateStatus, ...events: UpdateEvent[]): UpdateStatus =>
  events.reduce(nextUpdateStatus, start)

const idle: UpdateStatus = { state: 'idle' }
const url = 'https://github.com/fadyshenouda613/New-folder--2-/releases/tag/v0.2.0'

describe('nextUpdateStatus', () => {
  it('walks check → download → ready on a platform that can install', () => {
    expect(run(idle, { type: 'checking' })).toEqual({ state: 'checking' })
    expect(run(idle, { type: 'checking' }, { type: 'available', version: '0.2.0', installable: true, url }))
      .toEqual({ state: 'downloading', version: '0.2.0', percent: 0 })
    expect(
      run(
        idle,
        { type: 'available', version: '0.2.0', installable: true, url },
        { type: 'progress', percent: 42.5 },
        { type: 'downloaded', version: '0.2.0' }
      )
    ).toEqual({ state: 'ready', version: '0.2.0' })
  })

  it('offers the download page where the build cannot be swapped in place', () => {
    expect(run(idle, { type: 'available', version: '0.2.0', installable: false, url })).toEqual({
      state: 'available',
      version: '0.2.0',
      url
    })
  })

  it('goes back to idle when the feed has nothing newer', () => {
    expect(run({ state: 'checking' }, { type: 'not-available' })).toEqual(idle)
  })

  it('reports a failed check or download without pretending anything else', () => {
    expect(run({ state: 'downloading', version: '0.2.0', percent: 10 }, { type: 'error', message: 'net::ERR' }))
      .toEqual({ state: 'error', message: 'net::ERR' })
  })

  it('holds a settled offer through the periodic re-check and a later error', () => {
    const ready: UpdateStatus = { state: 'ready', version: '0.2.0' }
    expect(run(ready, { type: 'checking' })).toEqual(ready)
    expect(run(ready, { type: 'available', version: '0.2.0', installable: true, url })).toEqual(ready)
    expect(run(ready, { type: 'error', message: 'offline' })).toEqual(ready)

    const available: UpdateStatus = { state: 'available', version: '0.2.0', url }
    expect(run(available, { type: 'checking' }, { type: 'error', message: 'offline' })).toEqual(available)
  })

  it('clamps progress and ignores it outside a download', () => {
    expect(run({ state: 'downloading', version: '0.2.0', percent: 10 }, { type: 'progress', percent: 130 }))
      .toEqual({ state: 'downloading', version: '0.2.0', percent: 100 })
    expect(run(idle, { type: 'progress', percent: 50 })).toEqual(idle)
  })

  it('never leaves disabled', () => {
    const disabled: UpdateStatus = { state: 'disabled', reason: 'development build' }
    expect(run(disabled, { type: 'checking' }, { type: 'available', version: '9', installable: true, url }))
      .toEqual(disabled)
  })
})
