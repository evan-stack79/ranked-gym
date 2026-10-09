import { describe, expect, it } from 'vitest'
import { isGymLeaderboardEnabled } from './gymLeaderboardFeatureFlag'

describe('VITE_ENABLE_GYM_LEADERBOARD', () => {
  it('stays OFF when unset (safe default)', () => {
    expect(isGymLeaderboardEnabled(undefined)).toBe(false)
    expect(isGymLeaderboardEnabled('')).toBe(false)
  })

  it('honors explicit true / false', () => {
    expect(isGymLeaderboardEnabled('true')).toBe(true)
    expect(isGymLeaderboardEnabled('false')).toBe(false)
  })
})
