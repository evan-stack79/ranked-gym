import { describe, expect, it } from 'vitest'
import { nutritionDayCache, diaryRollup } from './diaryRollup.ts'
import { readHomeNutritionDay } from './homeRead.ts'

describe('UI-N1 lecture accueil', () => {
  const todayMeals = [{ mealType: 'breakfast', calories: 100, proteinG: 10 }]

  it('le snapshot gagne et un jour vide reste null, pas 0', () => {
    const snapshot = nutritionDayCache({
      rollup: diaryRollup({
        meals: [{ mealType: 'dinner', calories: 830, proteinG: 101 }],
        waterMl: 750,
      }),
      targetKcal: 2798,
      proteinTargetG: 97.6,
    })
    const fromSnapshot = readHomeNutritionDay({
      snapshot,
      todayMeals,
      todayWaterMl: 0,
      waterGoalMl: null,
    })
    expect(fromSnapshot.source).toBe('snapshot')
    expect(fromSnapshot.kcal).toBe(830)
    expect(fromSnapshot.proteinG).toBe(101)
    expect(fromSnapshot.showWaterRing).toBe(false)

    const withGoal = readHomeNutritionDay({
      snapshot,
      todayMeals: [],
      todayWaterMl: null,
      waterGoalMl: 2000,
    })
    expect(withGoal.showWaterRing).toBe(true)
    expect(withGoal.waterMl).toBe(750)

    const empty = readHomeNutritionDay({
      snapshot: null,
      todayMeals: [],
      todayWaterMl: null,
      waterGoalMl: 2000,
    })
    expect(empty.source).toBe('today')
    expect(empty.kcal).toBeNull()
    expect(empty.logged).toBe(false)
    expect(empty.showWaterRing).toBe(false)

    const today = readHomeNutritionDay({
      snapshot: null,
      todayMeals,
      todayWaterMl: 250,
      waterGoalMl: 2000,
    })
    expect(today.kcal).toBe(100)
    expect(today.showWaterRing).toBe(true)
    expect(today.waterMl).toBe(250)
  })
})
