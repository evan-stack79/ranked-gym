import { describe, expect, it } from 'vitest'
import {
  areLoadHistoriesIsolated,
  beginnerProgrammeEligibility,
  buildBeginnerExerciseEntry,
  buildBeginnerRoutineExercises,
  GAINAGE_HOLD_TEXT,
} from './beginnerProgramme'
import { BEGINNER_EXERCISES } from '../data/beginnerProgramme'
import { suggestLoadIncrease } from './loadIncreaseSuggest'
import type { WorkoutNote } from '../types/training'

describe('Programme Débutant', () => {
  it('is hidden for under-18, pregnancy, and breastfeeding', () => {
    expect(
      beginnerProgrammeEligibility({
        age: 17,
        declaredPregnancy: false,
        declaredBreastfeeding: false,
        healthAnswer: 'none',
      }).eligible,
    ).toBe(false)
    expect(
      beginnerProgrammeEligibility({
        age: 28,
        declaredPregnancy: true,
        declaredBreastfeeding: false,
        healthAnswer: 'situations',
      }).reason,
    ).toBe('pregnancy')
    expect(
      beginnerProgrammeEligibility({
        age: 28,
        declaredPregnancy: false,
        declaredBreastfeeding: true,
        healthAnswer: 'situations',
      }).reason,
    ).toBe('breastfeeding')
    expect(
      beginnerProgrammeEligibility({
        age: 28,
        declaredPregnancy: false,
        declaredBreastfeeding: false,
        healthAnswer: 'none',
      }).eligible,
    ).toBe(true)
  })

  it('stores machine-busy swap as a different exercise id (load histories stay isolated)', () => {
    const presse = BEGINNER_EXERCISES.find((s) => s.catalogId === 'leg_press')!
    const machine = buildBeginnerExerciseEntry(presse, { machineBusy: false })!
    const swap = buildBeginnerExerciseEntry(presse, { machineBusy: true })!
    expect(machine.canonicalExerciseId).toBe('leg_press')
    expect(swap.canonicalExerciseId).toBe('goblet_squat')
    expect(areLoadHistoriesIsolated(machine.canonicalExerciseId!, swap.canonicalExerciseId!)).toBe(
      true,
    )

    const legCurl = BEGINNER_EXERCISES.find((s) => s.catalogId === 'seated_leg_curl')!
    expect(buildBeginnerExerciseEntry(legCurl, { machineBusy: true })).toBeNull()

    const built = buildBeginnerRoutineExercises({
      machineBusyIds: ['leg_press', 'lat_pulldown', 'seated_leg_curl'],
    })
    expect(built.some((e) => e.canonicalExerciseId === 'seated_leg_curl')).toBe(false)
    expect(built.some((e) => e.canonicalExerciseId === 'goblet_squat')).toBe(true)
    expect(built.some((e) => e.canonicalExerciseId === 'single_arm_dumbbell_row')).toBe(true)
  })

  it('gainage uses exact hold text and never mixes load history with lifts', () => {
    expect(GAINAGE_HOLD_TEXT).toBe(
      "Tiens tant que ton dos reste droit. Arrête avant d'avoir mal.",
    )
    const gainage = BEGINNER_EXERCISES.find((s) => s.kind === 'gainage')!
    const entry = buildBeginnerExerciseEntry(gainage)!
    expect(entry.note).toBe(GAINAGE_HOLD_TEXT)
    expect(entry.sets).toEqual([])
  })

  it('suggests load +2–10% only after two sessions over target on the same catalogId', () => {
    const mk = (id: string, catalogId: string, reps: number, weight: number): WorkoutNote => ({
      id,
      title: 'Débutant',
      dateKey: '2026-10-0' + id.slice(-1),
      createdAt: Number(id.slice(-1)),
      estimatedKcal: 0,
      exercises: [
        {
          id: `ex-${id}`,
          name: 'Presse',
          canonicalExerciseId: catalogId,
          sets: [{ reps, weightKg: weight }],
        },
      ],
    })
    const same = suggestLoadIncrease({
      catalogId: 'leg_press',
      plannedReps: 12,
      notes: [mk('n2', 'leg_press', 13, 60), mk('n1', 'leg_press', 14, 60)],
    })
    expect(same.suggest).toBe(true)
    expect(same.factor).toBeGreaterThanOrEqual(1.02)
    expect(same.factor).toBeLessThanOrEqual(1.1)

    // Swap id must not borrow machine history
    const mixed = suggestLoadIncrease({
      catalogId: 'goblet_squat',
      plannedReps: 12,
      notes: [mk('n2', 'leg_press', 13, 60), mk('n1', 'leg_press', 14, 60)],
    })
    expect(mixed.suggest).toBe(false)
  })
})
