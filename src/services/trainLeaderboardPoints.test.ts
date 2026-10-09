import { describe, expect, it } from 'vitest'
import {
  assertTrainSessionGivesNoPoints,
  canAwardLeaderboardPoints,
} from './trainLeaderboardPoints'
import { isGymLeaderboardEnabled } from '../backend/gymLeaderboardFeatureFlag'

describe('Train sessions never give leaderboard points', () => {
  it('blocks train_session as a point source; flag stays off by default', () => {
    expect(canAwardLeaderboardPoints('train_session')).toBe(false)
    expect(canAwardLeaderboardPoints('validated_gym_presence')).toBe(true)
    expect(() => assertTrainSessionGivesNoPoints()).not.toThrow()
    expect(isGymLeaderboardEnabled(undefined)).toBe(false)
  })
})
