import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalorieProfile } from '../types/nutrition'
import type { TrainingState } from '../types/training'
import { getNutritionTarget } from './nutritionActivity'

const BASE_PROFILE: CalorieProfile = {
  weightKg: 75,
  goalWeightKg: 72,
  heightCm: 175,
  age: 28,
  sex: 'male',
  activity: 'moderate',
  morphology: 'mesomorph',
  goal: 'maintain',
  weeklyPaceKg: 0,
  onboardingComplete: true,
}

const BASE_TRAINING: TrainingState = {
  primarySportId: 'musculation',
  favoriteSportIds: ['musculation'],
  stepsToday: 0,
  stepsDateKey: '2026-08-24',
  healthLinked: false,
  notificationsEnabled: false,
  templates: [],
  schedule: [],
  completed: [],
  workoutNotes: [],
  routines: [],
}

vi.mock('./trainingStorage', () => ({
  getTrainingState: vi.fn(() => ({ ...BASE_TRAINING })),
}))

vi.mock('./nutritionStorage', () => ({
  getCalorieProfile: vi.fn(() => ({ ...BASE_PROFILE })),
}))

describe('getNutritionTarget — pas de double comptabilisation', () => {
  beforeEach(async () => {
    const training = await import('./trainingStorage')
    vi.mocked(training.getTrainingState).mockReturnValue({ ...BASE_TRAINING, stepsToday: 0 })
  })

  it('target_kcal identique quelle que soit la variation steps/workout (non injectés)', async () => {
    const training = await import('./trainingStorage')

    const low = getNutritionTarget(BASE_PROFILE)
    vi.mocked(training.getTrainingState).mockReturnValue({
      ...BASE_TRAINING,
      stepsToday: 12000,
      workoutNotes: [
        {
          id: 'w1',
          title: 'Push',
          dateKey: '2026-08-24',
          createdAt: Date.now(),
          durationMin: 90,
          estimatedKcal: 600,
          exercises: [],
        },
      ],
    })

    const high = getNutritionTarget(BASE_PROFILE)

    expect(low.engineOk).toBe(true)
    expect(high.engineOk).toBe(true)
    expect(high.targetCalories).toBe(low.targetCalories)
    expect(high.activityBonus).toBe(0)
    expect(high.proteinG).toBe(low.proteinG)
    expect(high.carbsG).toBe(low.carbsG)
    expect(high.fatG).toBe(low.fatG)
  })

  it('activityBonus reste toujours 0', () => {
    const result = getNutritionTarget(BASE_PROFILE)
    expect(result.activityBonus).toBe(0)
  })
})

describe('getNutritionTarget — cas écran 61,7 kg force + prise de masse', () => {
  const SCREEN_PROFILE: CalorieProfile = {
    weightKg: 61.7,
    goalWeightKg: 65,
    heightCm: 170,
    age: 18,
    sex: 'male',
    activity: 'athlete',
    morphology: 'ectomorph',
    goal: 'bulk',
    weeklyPaceKg: 0.5,
    onboardingComplete: true,
  }

  beforeEach(async () => {
    const training = await import('./trainingStorage')
    vi.mocked(training.getTrainingState).mockReturnValue({
      ...BASE_TRAINING,
      primarySportId: 'musculation',
    })
  })

  it('Prot_Min 1.4, Prot_Target 1.6, V2 redistrib → protéines ≈ 135.7 g, FLAG remaining', async () => {
    const { runNutritionEngine, ALLOCATION_FLAGS } = await import('../nutrition-engine')
    const { profileToEngineInput } = await import('./nutritionEngineAdapter')

    const input = profileToEngineInput(SCREEN_PROFILE)
    expect(input.sport_principal).toBe('musculation')
    expect(input.goal).toBe('bulk')
    expect(input.surplus_kcal).toBe(550)

    const engine = runNutritionEngine(input)
    expect(engine.ok).toBe(true)
    if (!engine.ok) return

    expect(engine.constraints.prot_min_g / 61.7).toBeCloseTo(1.4, 6)
    expect(engine.constraints.prot_target_g / 61.7).toBeCloseTo(1.6, 6)
    expect(engine.macros.proteines_g).toBeCloseTo(61.7 * 2.2, 5)
    expect(Math.round(engine.bcmr_kcal)).toBe(623)
    expect(engine.allocation_flags).toContain(ALLOCATION_FLAGS.CARB_REVIEW_REMAINING_AFTER_LIMITS)

    const ui = getNutritionTarget(SCREEN_PROFILE)
    expect(ui.engineOk).toBe(true)
    expect(ui.proteinG).toBeCloseTo(135.7, 1)
    expect(ui.bcmrKcal).toBe(623)
    expect(ui.targetCalories).toBe(3851)
    expect(ui.allocationFlags).toContain(ALLOCATION_FLAGS.CARB_REVIEW_REMAINING_AFTER_LIMITS)
    expect(ui.activityBonus).toBe(0)

    const conserved =
      engine.macros.proteines_g * 4 + engine.macros.lipides_g * 9 + engine.macros.glucides_g * 4
    expect(Math.abs(conserved - engine.target_kcal)).toBeLessThanOrEqual(3)
  })
})
