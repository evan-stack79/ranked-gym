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
