/**
 * Architect rule: a session logged in Train NEVER gives leaderboard points.
 * Only a validated gym presence counts (PR #101). This module is the
 * single gate — Train save paths must not call award paths.
 */

export type LeaderboardPointSource = 'validated_gym_presence' | 'train_session'

/** Train sessions are never a valid point source. */
export function canAwardLeaderboardPoints(source: LeaderboardPointSource): boolean {
  return source === 'validated_gym_presence'
}

export function assertTrainSessionGivesNoPoints(): void {
  if (canAwardLeaderboardPoints('train_session')) {
    throw new Error('Train sessions must never award leaderboard points')
  }
}
