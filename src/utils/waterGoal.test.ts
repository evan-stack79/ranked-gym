import { describe, expect, it } from 'vitest'
import * as waterGoal from './waterGoal'
import { formatWaterMl, isTrainingDayToday } from './waterGoal'

describe('waterGoal — plus de calcul poids', () => {
  it('n’exporte plus de calcul basé sur le poids', () => {
    expect(waterGoal).not.toHaveProperty('calculateDailyWaterGoal')
    expect(waterGoal).not.toHaveProperty('getDailyWaterGoalMl')
    expect(waterGoal).not.toHaveProperty('WATER_ML_PER_KG')
    expect(waterGoal).not.toHaveProperty('TRAINING_DAY_WATER_BONUS_ML')
    expect(waterGoal).not.toHaveProperty('FALLBACK_WATER_WEIGHT_KG')
  })

  it('conserve formatWaterMl et les helpers jour d’entraînement', () => {
    expect(formatWaterMl(250)).toBe('250 ml')
    expect(formatWaterMl(1500)).toBe('1,5 L')
    expect(typeof isTrainingDayToday).toBe('function')
  })
})
