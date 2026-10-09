import { describe, expect, it } from 'vitest'
import { weeklyGoalFillRatio, weeklyGoalReached } from './trainWeeklyGoalFill'

describe('weeklyGoalFillRatio — bar ↔ text source of truth', () => {
  it('maps done/target to the same ratio the bar must use', () => {
    expect(weeklyGoalFillRatio(0, 2)).toBe(0)
    expect(weeklyGoalFillRatio(1, 2)).toBe(0.5)
    expect(weeklyGoalFillRatio(2, 2)).toBe(1)
    expect(weeklyGoalFillRatio(3, 2)).toBe(1)
    expect(weeklyGoalFillRatio(0, 5)).toBe(0)
    expect(weeklyGoalFillRatio(5, 5)).toBe(1)
  })

  it('stays stable after remount-like resets (0/2, 1/2, 2/2)', () => {
    const cases: Array<[number, number, number]> = [
      [0, 2, 0],
      [1, 2, 0.5],
      [2, 2, 1],
      [0, 1, 0],
      [1, 1, 1],
    ]
    for (const [done, target, ratio] of cases) {
      expect(weeklyGoalFillRatio(done, target)).toBe(ratio)
      expect(weeklyGoalReached(done, target)).toBe(done >= target && target > 0)
    }
  })

  it('guards invalid targets', () => {
    expect(weeklyGoalFillRatio(2, 0)).toBe(0)
    expect(weeklyGoalFillRatio(2, -1)).toBe(0)
    expect(weeklyGoalFillRatio(Number.NaN, 2)).toBe(0)
  })
})
