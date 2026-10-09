import { describe, expect, it } from 'vitest'
import {
  isSparkWithinWcagFlashLimit,
  sparkFlashesPerSecond,
  WCAG_MAX_FLASHES_PER_SECOND,
  WEEKLY_GOAL_FILL_MS,
  WEEKLY_GOAL_SPARK_FLASH_COUNT,
  WEEKLY_GOAL_SPARK_MS,
} from './trainWeeklyGoalMotion'

describe('weekly goal bar motion — WCAG 2.2 SC 2.3.1', () => {
  it('spark burst does not flash more than 3 times per second', () => {
    expect(WEEKLY_GOAL_SPARK_FLASH_COUNT).toBe(1)
    expect(WEEKLY_GOAL_SPARK_MS).toBeGreaterThan(0)
    const fps = sparkFlashesPerSecond(WEEKLY_GOAL_SPARK_MS, WEEKLY_GOAL_SPARK_FLASH_COUNT)
    expect(fps).toBeLessThanOrEqual(WCAG_MAX_FLASHES_PER_SECOND)
    expect(isSparkWithinWcagFlashLimit()).toBe(true)
  })

  it('fill transition stays ≤ 400 ms', () => {
    expect(WEEKLY_GOAL_FILL_MS).toBeLessThanOrEqual(400)
  })

  it('rejects a strobing pattern above the WCAG ceiling', () => {
    // 4 flashes in 1s would fail SC 2.3.1
    expect(isSparkWithinWcagFlashLimit(1000, 4)).toBe(false)
    expect(sparkFlashesPerSecond(1000, 4)).toBeGreaterThan(WCAG_MAX_FLASHES_PER_SECOND)
  })
})
