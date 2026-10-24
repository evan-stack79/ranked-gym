import { describe, expect, it } from 'vitest'
import { muscleFreshness } from '../progression-engine/freshness.ts'
import { preparationScore } from '../progression-engine/preparation.ts'
import { applyProteinGoalToDay, PROTEIN_GOAL_HALF_LIFE_FACTOR } from './proteinGoalFreshness.ts'

describe('TS-N2 demi-vie protein_goal rétroactive sur le dateKey', () => {
  const events = [
    { muscles: ['Pectoraux'], units: 100, hoursAgo: 48 },
    { muscles: ['Quadriceps'], units: 100, hoursAgo: 24 },
  ]

  it('à 48 h les pectoraux passent de 63 à 67, la préparation reste 65', () => {
    const preparation = preparationScore({
      tstHoursToday: 8,
      sleepBankMinutes: -300,
      yesterdayStrainZ: 0.2,
    })
    expect(preparation.score).toBe(65)
    expect(muscleFreshness(events)).toEqual({ Pectoraux: 63, Quadriceps: 33 })
    const locked = applyProteinGoalToDay({
      preparation: preparation.score,
      events,
      proteinGoalUnlocked: false,
    })
    expect(locked.freshnessHalfLifeFactor).toBe(1)
    expect(locked.preparation).toBe(65)
    expect(locked.muscleFreshness).toEqual({ Pectoraux: 63, Quadriceps: 33 })
    const unlocked = applyProteinGoalToDay({
      preparation: preparation.score,
      events,
      proteinGoalUnlocked: true,
    })
    expect(unlocked.freshnessHalfLifeFactor).toBe(PROTEIN_GOAL_HALF_LIFE_FACTOR)
    expect(unlocked.preparation).toBe(65)
    expect(unlocked.muscleFreshness).toEqual({ Pectoraux: 67, Quadriceps: 36 })
  })

  it('heures = 0 : le facteur ne change pas la fraîcheur, le test observe donc un délai', () => {
    const immediate = [{ muscles: ['Pectoraux'], units: 100, hoursAgo: 0 }]
    expect(muscleFreshness(immediate)).toEqual({ Pectoraux: 0 })
    expect(muscleFreshness(immediate, { halfLifeFactor: 0.9 })).toEqual({ Pectoraux: 0 })
  })
})
