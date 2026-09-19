import { describe, expect, it } from 'vitest'
import { exercisesVolume, totalVolume } from './strength'
import type { ExerciseEntry, WorkoutSet } from '../types/training'

describe('volume — formule exacte', () => {
  it('totalVolume = round(Σ reps × weightKg) sur toutes les séries présentes', () => {
    const sets: WorkoutSet[] = [
      { reps: 10, weightKg: 80, done: true },
      { reps: 8, weightKg: 80, done: true },
      { reps: 6, weightKg: 80, done: false },
    ]
    // 800 + 640 + 480 = 1920 — les séries non-done comptent aussi (politique actuelle).
    expect(totalVolume(sets)).toBe(1920)
  })

  it('repro 4240 kg plausible sans double comptage ni bodyweight', () => {
    const exercises: ExerciseEntry[] = [
      {
        id: '1',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [
          { reps: 10, weightKg: 80, done: true },
          { reps: 8, weightKg: 80, done: true },
          { reps: 8, weightKg: 80, done: true },
          { reps: 6, weightKg: 80, done: true },
        ],
      },
      {
        id: '2',
        name: 'Squat',
        canonicalExerciseId: 'back_squat',
        sets: [
          { reps: 8, weightKg: 100, done: true },
          { reps: 8, weightKg: 100, done: true },
          { reps: 8, weightKg: 100, done: true },
        ],
      },
      {
        id: '3',
        name: 'Rowing barre',
        canonicalExerciseId: 'barbell_row',
        sets: [
          { reps: 10, weightKg: 60, done: true },
          { reps: 10, weightKg: 60, done: true },
          { reps: 8, weightKg: 60, done: true },
        ],
      },
    ]
    // bench 800+640+640+480=2560 ; squat 800*3=2400 ; row 600+600+480=1680 → 6640
    // Cas 4240 : ex. 4× (10×80 + 8×70) = 4×(800+560)=5440 ≠ ; ou 53 séries×80…
    // Vérifie qu’un total 4240 est atteignable sans ×2 haltères ni poids de corps :
    const repro4240: WorkoutSet[] = [
      { reps: 10, weightKg: 80 }, // 800
      { reps: 10, weightKg: 80 }, // 800
      { reps: 8, weightKg: 80 }, // 640
      { reps: 8, weightKg: 80 }, // 640
      { reps: 10, weightKg: 60 }, // 600
      { reps: 10, weightKg: 60 }, // 600
      { reps: 8, weightKg: 20 }, // 160
    ]
    expect(totalVolume(repro4240)).toBe(4240)
    expect(exercisesVolume([{ id: 'x', name: 'mix', sets: repro4240 }])).toBe(4240)
    expect(exercisesVolume(exercises)).toBe(6640)
  })
})
