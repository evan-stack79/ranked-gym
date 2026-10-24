import { describe, expect, it } from 'vitest'
import { formatApiPayload, runNutritionEngine } from './engine.ts'
import { diaryRollup, displayedKcal, nutritionDayCache, nutritionTargetKcal, weeklyMeanKcal } from './diaryRollup.ts'
import { evaluateNutritionXp } from './nutritionXp.ts'
import type { NutritionEngineInput } from './types.ts'

const FROZEN_PROFILE: NutritionEngineInput = {
  sex: 'male',
  age: 22,
  weight_kg: 61,
  height_m: 1.7,
  activity: 2,
  goal: 'bulk',
  deficit_kcal: 0,
  surplus_kcal: 250,
  sport_principal: 'musculation',
  sport_secondaire: null,
  duration_h: 0,
  intensity: null,
  effort_weight_loss_kg: 0,
  effort_fluid_loss_l: 0,
}

const JOURNAL = [
  { mealType: 'breakfast', calories: 150, proteinG: 25, carbsG: 10, fatG: 0, fiberG: 0 },
  { mealType: 'lunch', calories: 260, proteinG: 6, carbsG: 56, fatG: 0, fiberG: 2 },
  { mealType: 'dinner', calories: 330, proteinG: 69, carbsG: 0, fatG: 6, fiberG: 0 },
  { mealType: 'snack', calories: 90, proteinG: 1, carbsG: 23, fatG: 0, fiberG: 2 },
]

describe('TS-N1 journal figé — 2 798 kcal / 830 kcal / 35 XP', () => {
  const engine = runNutritionEngine(FROZEN_PROFILE)
  if (!engine.ok) throw new Error('engine')
  const api = formatApiPayload(engine)
  const proteinTargetG = engine.constraints.prot_target_g

  it('cible IOM 2798, protéines 97,6 g, API 98 / 78 / 426', () => {
    expect(engine.eer_kcal).toBeCloseTo(2547.8313, 4)
    expect(engine.target_kcal).toBeCloseTo(2797.8313, 4)
    expect(Math.round(engine.target_kcal)).toBe(2798)
    expect(api.status).toBe('SUCCESS')
    if (api.status !== 'SUCCESS') return
    expect(api.target_kcal).toBe(2798)
    expect(api.macros).toEqual({ proteines_g: 98, lipides_g: 78, glucides_g: 426 })
    expect(proteinTargetG).toBeCloseTo(97.6, 6)
    expect(nutritionTargetKcal(engine.target_kcal, 68)).toBeCloseTo(2797.8313, 4)
    expect(Math.round(nutritionTargetKcal(engine.target_kcal, 68))).toBe(2798)
  })

  it('somme les étiquettes 830 kcal / 101 g, pas Atwater, et crédite 35 XP', () => {
    const rollup = diaryRollup({
      meals: JOURNAL,
      waterEntries: [{ amountMl: 500 }, { amountMl: 250 }],
    })
    expect(rollup).toMatchObject({
      logged: true,
      kcal: 830,
      proteinG: 101,
      carbsG: 89,
      fatG: 6,
      fiberG: 4,
      waterMl: 750,
      hasBreakfast: true,
      hasLunch: true,
      hasDinner: true,
    })
    const xp = evaluateNutritionXp({ rollup, proteinTargetG, foodAddOpen: true })
    expect(xp.mealsCompleteXp).toBe(25)
    expect(xp.proteinGoalXp).toBe(10)
    expect(xp.totalXp).toBe(35)
    const cache = nutritionDayCache({
      rollup,
      targetKcal: Math.round(engine.target_kcal),
      proteinTargetG,
    })
    expect(cache.targetKcal).toBe(2798)
    expect(cache.kcal).toBe(830)
  })

  it('un seul jour loggé sur 7 → moyenne null ; trois jours → 1543', () => {
    expect(weeklyMeanKcal([830, null, null, null, null, null, null])).toBeNull()
    const mean = weeklyMeanKcal([830, 2000, null, 1800, null, null, null])
    expect(mean).toBeCloseTo(4630 / 3, 6)
    expect(displayedKcal(mean)).toBe(1543)
  })

  it('repas supprimé ou sans kcal ne compte pas ; le snack seul ne complète pas la journée', () => {
    const withoutDinner = diaryRollup({
      meals: JOURNAL.map((meal) =>
        meal.mealType === 'dinner' ? { ...meal, deletedAt: 1 } : meal,
      ),
    })
    expect(withoutDinner.kcal).toBe(500)
    expect(withoutDinner.hasDinner).toBe(false)
    expect(evaluateNutritionXp({ rollup: withoutDinner, proteinTargetG, foodAddOpen: true }).mealsComplete).toBe(
      false,
    )
    const snackOnly = diaryRollup({ meals: [JOURNAL[3]] })
    expect(evaluateNutritionXp({ rollup: snackOnly, proteinTargetG, foodAddOpen: true }).totalXp).toBe(0)
  })

  it('cible protéine null : meals 25 encore possibles, protein_goal non', () => {
    const rollup = diaryRollup({ meals: JOURNAL })
    const xp = evaluateNutritionXp({ rollup, proteinTargetG: null, foodAddOpen: true })
    expect(xp.mealsCompleteXp).toBe(25)
    expect(xp.proteinGoalXp).toBe(0)
    expect(xp.totalXp).toBe(25)
  })

  it('porte fermée : 0 XP', () => {
    const rollup = diaryRollup({ meals: JOURNAL })
    expect(evaluateNutritionXp({ rollup, proteinTargetG, foodAddOpen: false }).totalXp).toBe(0)
  })

  it('aliment rapide sans proteinG : on somme les protéines finies, on ne nullifie pas la journée', () => {
    const rollup = diaryRollup({
      meals: [...JOURNAL, { mealType: 'snack', calories: 40 }],
    })
    expect(rollup.kcal).toBe(870)
    expect(rollup.proteinG).toBe(101)
    expect(rollup.carbsG).toBe(89)
    expect(rollup.fatG).toBe(6)
    expect(rollup.fiberG).toBe(4)
    expect(
      evaluateNutritionXp({ rollup, proteinTargetG, foodAddOpen: true }).proteinGoal,
    ).toBe(true)
  })

  it('proteinG null seulement si aucun repas compté n’a de protéine finie', () => {
    const missing = diaryRollup({
      meals: [
        { mealType: 'breakfast', calories: 100 },
        { mealType: 'lunch', calories: 200, proteinG: null },
      ],
    })
    expect(missing.kcal).toBe(300)
    expect(missing.proteinG).toBeNull()
    const zero = diaryRollup({
      meals: [
        { mealType: 'breakfast', calories: 100, proteinG: 0 },
        { mealType: 'lunch', calories: 80 },
      ],
    })
    expect(zero.proteinG).toBe(0)
    const empty = diaryRollup({ meals: [] })
    expect(empty.logged).toBe(false)
    expect(empty.kcal).toBeNull()
    expect(empty.waterMl).toBeNull()
  })
})
