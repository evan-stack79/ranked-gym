import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalorieProfile } from '../types/nutrition'
import type { TrainingState } from '../types/training'
import {
  clampEngineTargetAndMacros,
  macrosToKcal,
  profileToEngineInput,
  rescaleMacrosToRaisedTarget,
} from './nutritionEngineAdapter'
import { getNutritionTarget } from './nutritionActivity'
import { runNutritionEngine, serializeEngineResult } from '../nutrition-engine'
import { estimateRmrKcal } from './nutritionSafetyRules'

const BASE_TRAINING: TrainingState = {
  primarySportId: 'musculation',
  favoriteSportIds: ['musculation'],
  stepsToday: 0,
  stepsDateKey: '2026-10-02',
  healthLinked: false,
  notificationsEnabled: false,
  templates: [],
  schedule: [],
  completed: [],
  workoutNotes: [],
  routines: [],
  lastSelectedRoutineId: null,
  lastSelectedSportId: null,
}

vi.mock('./trainingStorage', () => ({
  getTrainingState: vi.fn(() => ({ ...BASE_TRAINING })),
}))

vi.mock('./nutritionStorage', () => ({
  getCalorieProfile: vi.fn(() => ({
    weightKg: 50,
    goalWeightKg: 48,
    heightCm: 150,
    age: 60,
    sex: 'female',
    activity: 'sedentary',
    morphology: 'mesomorph',
    goal: 'cut',
    weeklyPaceKg: 0.25,
    onboardingComplete: true,
  })),
}))

function cutProfile(partial: Partial<CalorieProfile> & Pick<CalorieProfile, 'sex'>): CalorieProfile {
  return {
    weightKg: 50,
    goalWeightKg: 48,
    heightCm: 150,
    age: 60,
    activity: 'sedentary',
    morphology: 'mesomorph',
    goal: 'cut',
    weeklyPaceKg: 0.25,
    onboardingComplete: true,
    declaredPregnancy: false,
    declaredBreastfeeding: false,
    declaredEatingDisorder: false,
    preferNotAnswerHealth: false,
    ...partial,
  }
}

describe('QA BUG-13 — macros cohérentes avec la cible relevée au plancher', () => {
  beforeEach(async () => {
    const training = await import('./trainingStorage')
    vi.mocked(training.getTrainingState).mockReturnValue({ ...BASE_TRAINING })
  })

  it.each([
    { label: 'femme 60 ans 50 kg/150 cm sédentaire Sèche', sex: 'female' as const },
    { label: 'homme 60 ans 50 kg/150 cm sédentaire Sèche', sex: 'male' as const },
  ])('$label : macros ≈ cible affichée (écart < 5 %)', ({ sex }) => {
    const profile = cutProfile({ sex })
    const ui = getNutritionTarget(profile, { calorieGoalEnabled: true })
    expect(ui.engineOk).toBe(true)
    expect(ui.targetCalories).toBeGreaterThanOrEqual(1200)

    const rmr = estimateRmrKcal(profile.weightKg, profile.heightCm, profile.age, sex)
    expect(ui.targetCalories).toBeGreaterThanOrEqual(Math.max(1200, Math.round(rmr)))

    const macroKcal = macrosToKcal({
      proteinG: ui.proteinG,
      carbsG: ui.carbsG,
      fatG: ui.fatG,
    })
    const drift = Math.abs(macroKcal - ui.targetCalories) / ui.targetCalories
    expect(drift).toBeLessThan(0.05)
  })

  it('rescaleMacrosToRaisedTarget remonte les macros quand la cible est relevée', () => {
    const raised = rescaleMacrosToRaisedTarget(1200, {
      proteinG: 90,
      carbsG: 80,
      fatG: 35,
    })
    // ~90*4 + 80*4 + 35*9 = 995 → doit monter vers 1200
    const kcal = macrosToKcal(raised)
    expect(Math.abs(kcal - 1200) / 1200).toBeLessThan(0.05)
  })

  it('clampEngineTargetAndMacros marque raisedToFloor et aligne les macros', () => {
    const profile = cutProfile({ sex: 'female' })
    const engine = runNutritionEngine(
      profileToEngineInput(profile, { calorieGoalEnabled: true }),
    )
    expect(engine.ok).toBe(true)
    if (!engine.ok) return
    const serialized = serializeEngineResult(engine)
    const clamped = clampEngineTargetAndMacros(
      profile,
      serialized.target_kcal,
      serialized.eer_kcal,
      {
        proteinG: serialized.proteines_g,
        carbsG: serialized.glucides_g,
        fatG: serialized.lipides_g,
      },
    )
    if (clamped.raisedToFloor) {
      const drift =
        Math.abs(
          macrosToKcal({
            proteinG: clamped.proteinG,
            carbsG: clamped.carbsG,
            fatG: clamped.fatG,
          }) - clamped.targetCalories,
        ) / clamped.targetCalories
      expect(drift).toBeLessThan(0.05)
    }
  })

  it('balayage grille : macros cohérentes avec la cible relevée (écart < 5 %)', () => {
    const ages = [19, 25, 40, 60]
    const sexes = ['female', 'male'] as const
    const weights = [50, 70, 90]
    const heights = [150, 170, 180]
    const activities = ['sedentary', 'moderate'] as const

    let checked = 0
    let raisedCases = 0

    for (const age of ages) {
      for (const sex of sexes) {
        for (const weightKg of weights) {
          for (const heightCm of heights) {
            for (const activity of activities) {
              const profile = cutProfile({
                age,
                sex,
                weightKg,
                heightCm,
                activity,
                goalWeightKg: Math.max(40, weightKg - 5),
                weeklyPaceKg: 0.3,
              })
              const ui = getNutritionTarget(profile, { calorieGoalEnabled: true })
              if (!ui.engineOk || ui.targetCalories <= 0) continue
              checked += 1

              const input = profileToEngineInput(profile, { calorieGoalEnabled: true })
              const engine = runNutritionEngine(input)
              if (!engine.ok) continue
              const serialized = serializeEngineResult(engine)
              if (ui.targetCalories > Math.round(serialized.target_kcal)) {
                raisedCases += 1
              }

              const macroKcal = macrosToKcal({
                proteinG: ui.proteinG,
                carbsG: ui.carbsG,
                fatG: ui.fatG,
              })
              const drift = Math.abs(macroKcal - ui.targetCalories) / ui.targetCalories
              expect(drift).toBeLessThan(0.05)
            }
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(20)
    // Au moins quelques profils légers doivent relever au plancher (sinon le bug n'est pas couvert).
    expect(raisedCases).toBeGreaterThan(0)
  })
})
