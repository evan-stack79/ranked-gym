import { describe, expect, it } from 'vitest'
import { isGymLeaderboardEnabled } from './gymLeaderboardFeatureFlag'

describe('isGymLeaderboardEnabled', () => {
  it('honors explicit true/false', () => {
    expect(isGymLeaderboardEnabled('true')).toBe(true)
    expect(isGymLeaderboardEnabled('false')).toBe(false)
    expect(isGymLeaderboardEnabled('1')).toBe(true)
  })

  it('defaults ON in test mode when unset', () => {
    // vitest MODE === 'test'
    expect(isGymLeaderboardEnabled(undefined)).toBe(true)
    expect(isGymLeaderboardEnabled('')).toBe(true)
  })
})
