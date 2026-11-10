import type { RankTier } from '../types'
import { getRankFromLevel } from './rank'

/** True when level change crosses a named Ranked tier boundary (e.g. Bronze → Argent). */
export function didRankTierUp(previousLevel: number, nextLevel: number): boolean {
  const from = getRankFromLevel(previousLevel).tier
  const to = getRankFromLevel(nextLevel).tier
  return from !== to && nextLevel > previousLevel
}

export function tierPairFromLevels(
  previousLevel: number,
  nextLevel: number,
): { from: RankTier; to: RankTier } {
  return {
    from: getRankFromLevel(previousLevel).tier,
    to: getRankFromLevel(nextLevel).tier,
  }
}
