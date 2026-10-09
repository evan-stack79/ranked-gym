import { describe, expect, it } from 'vitest'
import {
  canFinishSession,
  canValidateSet,
  SESSION_COMPLETE_BURST_MS,
  SET_VALIDATED_POP_MS,
} from './sessionActionGuards'

describe('sessionActionGuards — persist-first / idempotent', () => {
  it('canValidateSet blocks done sets and in-flight persist', () => {
    expect(canValidateSet(undefined)).toBe(false)
    expect(canValidateSet({ done: true })).toBe(false)
    expect(canValidateSet({ done: false }, { persistInFlight: true })).toBe(false)
    expect(canValidateSet({ done: false })).toBe(true)
  })

  it('canFinishSession blocks double finish', () => {
    expect(canFinishSession({ saving: true })).toBe(false)
    expect(canFinishSession({ saving: false, finishCommitted: true })).toBe(false)
    expect(canFinishSession({ saving: false, finishCommitted: false })).toBe(true)
  })

  it('celebration timings are fixed (identical every session)', () => {
    expect(SESSION_COMPLETE_BURST_MS).toBe(1000)
    expect(SET_VALIDATED_POP_MS).toBe(340)
  })
})
