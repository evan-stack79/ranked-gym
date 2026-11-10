import { describe, expect, it } from 'vitest'
import { didRankTierUp, tierPairFromLevels } from './rankTierUp'

describe('didRankTierUp', () => {
  it('detects Bronze → Argent at level 11', () => {
    expect(didRankTierUp(10, 11)).toBe(true)
    expect(tierPairFromLevels(10, 11)).toEqual({ from: 'Bronze', to: 'Argent' })
  })

  it('ignores level-ups inside the same tier', () => {
    expect(didRankTierUp(5, 6)).toBe(false)
    expect(didRankTierUp(11, 15)).toBe(false)
  })

  it('ignores level decreases', () => {
    expect(didRankTierUp(11, 10)).toBe(false)
  })
})
