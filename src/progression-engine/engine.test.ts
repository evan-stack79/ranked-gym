import { describe, expect, it } from 'vitest'
import { STRAIN_SCALE_FALLBACK } from './constants.ts'
import { buildProgressionDay } from './engine.ts'
import { muscleFreshness, muscleShares } from './freshness.ts'
import { effectiveLoadKg } from './load.ts'
import { trainingLoadRatio } from './loadRatio.ts'
import { setStrainUnits } from './strain.ts'
import { readSetGroups, withAdditiveSetGroups } from './workoutContract.ts'
import { nextPerformanceRating } from './xp.ts'

const FROZEN_SETS = [
  { reps: 8, loggedKg: 80, rpe: 8, loadMode: 'external' as const },
  { reps: 8, loggedKg: 80, rpe: 8, loadMode: 'external' as const },
  { reps: 8, loggedKg: 80, rpe: 8, loadMode: 'external' as const },
  { reps: 8, loggedKg: 80, rpe: 8, loadMode: 'external' as const },
  { reps: 8, loggedKg: 70, rpe: 7, loadMode: 'external' as const },
  { reps: 8, loggedKg: 70, rpe: 7, loadMode: 'external' as const },
  { reps: 8, loggedKg: 70, rpe: 7, loadMode: 'external' as const },
]

const FROZEN_NIGHTS = [7.5, 8, 6.5, 8, 7, 6, 8]

function frozenInput(overrides: Partial<Parameters<typeof buildProgressionDay>[0]> = {}) {
  return {
    sets: FROZEN_SETS,
    medianStrainRaw28: 160,
    baseline: { mean: 40, sd: 10, sampleCount: 14 },
    tstHoursLast7: FROZEN_NIGHTS,
    // z veille = 0,2 → score 66. Avec sommeil 100 et banque 0, la préparation arrondie vaut 65.
    yesterdayStrainZ: 0.2,
    ...overrides,
  }
}

describe('scénario figé', () => {
  it('strain 68, banque −300, préparation 65, 116 XP', () => {
    const day = buildProgressionDay(frozenInput())
    expect(day.workoutStrain).toBe(68)
    expect(day.strainZ).toBeCloseTo(2.8, 10)
    expect(day.strainBand).toBe('above')
    expect(day.sleepBankMinutes).toBe(-300)
    expect(day.preparation).toBe(65)
    expect(day.strainXp).toBe(41)
    expect(day.xpMultiplier).toBeCloseTo(0.9, 10)
    expect(day.xp).toBe(116)
    expect(day.strainScale).toBe(160)
    expect(day.performanceRating).toBe(1024)
  })
})

describe('cold start strain', () => {
  it('médiane null → échelle 150 et la part 0,6 × strain reste créditée', () => {
    const day = buildProgressionDay(frozenInput({ medianStrainRaw28: null }))
    expect(day.strainScale).toBe(STRAIN_SCALE_FALLBACK)
    expect(day.strainScale).toBe(150)
    expect(day.workoutStrain).toBe(71)
    expect(day.strainXp).toBe(43)
    expect(day.xp).toBe(118)
    expect(day.strainXp).toBeGreaterThan(0)
  })
})

describe('charge machine', () => {
  it('machine classique : le poids affiché, jamais le corps', () => {
    expect(effectiveLoadKg({ loadMode: 'machine', loggedKg: 20, bodyweightKg: 90 })).toBe(20)
    const units = setStrainUnits(
      { reps: 10, loggedKg: 20, rpe: 7, loadMode: 'machine' },
      90,
    )
    const subtracted = setStrainUnits(
      { reps: 10, loggedKg: 70, rpe: 7, loadMode: 'external' },
      90,
    )
    expect(units).not.toBe(subtracted)
    expect(units).toBeGreaterThan(0)
  })

  it('assistée : corps − aide, plancher 0', () => {
    expect(
      effectiveLoadKg({ loadMode: 'assisted_bodyweight', loggedKg: 20, bodyweightKg: 90 }),
    ).toBe(70)
    expect(
      effectiveLoadKg({ loadMode: 'assisted_bodyweight', loggedKg: 100, bodyweightKg: 80 }),
    ).toBe(0)
    expect(
      setStrainUnits({ reps: 8, loggedKg: 100, loadMode: 'assisted_bodyweight' }, 80),
    ).toBe(0)
  })
})

describe('fraîcheur', () => {
  it('un seul muscle reçoit 100 % ; 70/30 dès qu’il y a un secondaire', () => {
    expect(muscleShares(['Pectoraux'])).toEqual([{ muscle: 'Pectoraux', share: 1 }])
    expect(muscleShares(['Pectoraux', 'Triceps'])).toEqual([
      { muscle: 'Pectoraux', share: 0.7 },
      { muscle: 'Triceps', share: 0.3 },
    ])
    const three = muscleShares(['Pectoraux', 'Triceps', 'Épaules'])
    expect(three.map((share) => share.share)).toEqual([0.7, 0.15, 0.15])
  })

  it('sans historique, fraîcheur null ; juste après une série mono-muscle, 0', () => {
    expect(muscleFreshness([])).toBeNull()
    expect(muscleFreshness([{ muscles: ['Pectoraux'], units: 100, hoursAgo: 0 }])).toEqual({
      Pectoraux: 0,
    })
  })
})

describe('contrats nuls', () => {
  it('moins de 3 TST connus → banque null ; sans TST du jour → préparation null ; moins de 7 jours → z null', () => {
    const shortBank = buildProgressionDay(
      frozenInput({
        tstHoursLast7: [8, 7, null, null, null, null, null],
      }),
    )
    expect(shortBank.sleepBankMinutes).toBeNull()

    const day = buildProgressionDay(
      frozenInput({
        tstHoursLast7: [null, null, null, null, null, null, null],
        baseline: { mean: 40, sd: 10, sampleCount: 6 },
        yesterdayStrainZ: null,
      }),
    )
    expect(day.sleepBankMinutes).toBeNull()
    expect(day.strainZ).toBeNull()
    expect(day.preparation).toBeNull()
  })

  it('z = 0 ne bouge pas l’Elo', () => {
    expect(nextPerformanceRating({ rating: 1000, ratedSessions: 0, strainZ: 0 })).toBe(1000)
    expect(nextPerformanceRating({ rating: 1000, ratedSessions: 0, strainZ: null })).toBe(1000)
  })
})

describe('charge ATL/CTL', () => {
  it('quatre jours plats → ratio productif', () => {
    const load = trainingLoadRatio([10, 10, 10, 10])
    expect(load).not.toBeNull()
    expect(load?.status).toBe('productive')
    expect(load?.ratio).toBeCloseTo(1, 5)
  })

  it('moins de 4 jours actifs → null', () => {
    expect(trainingLoadRatio([10, 0, 10, 0])).toBeNull()
  })
})

describe('contrat v2 additif', () => {
  it('une note v1 se lit en groupes straight et se réécrit sans perdre les exercices', () => {
    const note = {
      id: 'n1',
      title: 'Push',
      exercises: [
        { id: 'ex1', name: 'Développé', sets: [{ reps: 8, weightKg: 80, rpe: 8 }] },
      ],
    }
    const groups = readSetGroups(note)
    expect(groups).toEqual([
      {
        id: 'straight:ex1',
        kind: 'straight',
        exerciseIds: ['ex1'],
        sets: [{ reps: 8, weightKg: 80, rpe: 8 }],
        defaultRestSec: undefined,
      },
    ])
    const written = withAdditiveSetGroups(note, groups)
    expect(written.schemaVersion).toBe(2)
    expect(written.exercises).toEqual(note.exercises)
    expect(written.title).toBe('Push')
    expect(readSetGroups(written)).toBe(groups)
  })
})
