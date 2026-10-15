/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetWaveEnterForTests,
  markWaveEnterSeen,
  shouldPlayWaveEnter,
} from './waveEnterOnce'

describe('waveEnterOnce', () => {
  beforeEach(() => {
    __resetWaveEnterForTests()
  })

  afterEach(() => {
    __resetWaveEnterForTests()
  })

  it('plays only the first time in a session', () => {
    expect(shouldPlayWaveEnter()).toBe(true)
    markWaveEnterSeen()
    expect(shouldPlayWaveEnter()).toBe(false)
  })
})