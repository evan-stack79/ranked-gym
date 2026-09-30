import { describe, expect, it } from 'vitest'
import {
  flattenMealPhotoAiSteps,
  MEAL_PHOTO_AI_PROGRESS_CAP,
  MEAL_PHOTO_AI_SEQUENCES,
  mealPhotoAiProgressPercent,
  resolveMealPhotoAiStep,
} from './mealPhotoAiLoading'

describe('mealPhotoAiLoading sequences', () => {
  it('only describes a meal photo analysis, never web-search or invented durations', () => {
    const blob = JSON.stringify(MEAL_PHOTO_AI_SEQUENCES)
    expect(blob.toLowerCase()).not.toContain('web')
    expect(blob.toLowerCase()).not.toContain('website')
    expect(blob).not.toMatch(/\d+\s*min/)
    expect(blob).not.toContain('NaN')
    expect(blob).not.toContain('undefined')

    const texts = flattenMealPhotoAiSteps().map((step) => step.text.toLowerCase())
    expect(texts.some((text) => text.includes('calorie'))).toBe(true)
    expect(texts.some((text) => text.includes('protéine'))).toBe(true)
    expect(texts.some((text) => text.includes('glucide'))).toBe(true)
    expect(texts.some((text) => text.includes('lipide'))).toBe(true)
  })

  it('caps perceived progress below 100 and never yields NaN', () => {
    expect(mealPhotoAiProgressPercent(Number.NaN, 10)).toBe(0)
    expect(mealPhotoAiProgressPercent(3, 0)).toBe(0)
    const last = flattenMealPhotoAiSteps().length - 1
    const { progress } = resolveMealPhotoAiStep(last)
    expect(Number.isFinite(progress)).toBe(true)
    expect(progress).toBeLessThanOrEqual(MEAL_PHOTO_AI_PROGRESS_CAP)
    expect(progress).toBeGreaterThan(0)
  })

  it('wraps the cursor onto the first status without inventing calories', () => {
    const total = flattenMealPhotoAiSteps().length
    const wrapped = resolveMealPhotoAiStep(total)
    expect(wrapped.step.status).toBe(MEAL_PHOTO_AI_SEQUENCES[0]?.status)
    expect(wrapped.step.text).not.toMatch(/\d+\s*kcal/)
  })
})
