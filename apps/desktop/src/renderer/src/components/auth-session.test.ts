import { describe, expect, it } from 'vitest'
import { ApiFailure } from '../data/result'
import { refusalLine } from './auth-session'

describe('refusalLine', () => {
  it('states each refusal as a fact and a next step', () => {
    expect(refusalLine(new ApiFailure({ code: 'unauthorized', message: 'x' }))).toContain('do not match')
    expect(refusalLine(new ApiFailure({ code: 'conflict', message: 'x' }))).toContain('already has an account')
    expect(refusalLine(new ApiFailure({ code: 'offline', message: 'x' }))).toContain('could not reach')
    expect(refusalLine(new ApiFailure({ code: 'rate_limited', message: 'x' }))).toContain('Too many attempts')
    expect(refusalLine(new ApiFailure({ code: 'validation', message: 'x' }))).toContain('email address')
    expect(refusalLine(new ApiFailure({ code: 'detached', message: 'x' }))).toContain('desktop app')
  })

  it('falls back to the message it was given, or a sentence when there is none', () => {
    expect(refusalLine(new ApiFailure({ code: 'internal', message: 'The server answered 502' }))).toBe('The server answered 502')
    expect(refusalLine(new Error(''))).toContain('Try again')
    expect(refusalLine('not an error')).toContain('Try again')
  })
})
