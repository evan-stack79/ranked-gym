import { describe, expect, it } from 'vitest'
import {
  buildDeterministicWorkout,
  clampDurationMin,
  exerciseCountForDuration,
  parseAiWorkoutPlan,
  resolveFocus,
} from '../../convex/lib/workoutGenerator'

describe('workoutGenerator', () => {
  it('clampDurationMin borne 20–120', () => {
    expect(clampDurationMin(5)).toBe(20)
    expect(clampDurationMin(45)).toBe(45)
    expect(clampDurationMin(200)).toBe(120)
  })

  it('mappe Upper V-Taper vers pull/shoulders', () => {
    const r = resolveFocus('Upper V-Taper')
    expect(r.movements).toEqual(expect.arrayContaining(['pull', 'shoulders']))
    expect(r.title).toBe('Upper V-Taper')
  })

  it('construit une séance déterministe avec 4–8 exercices', () => {
    const plan = buildDeterministicWorkout({ focus: 'Upper V-Taper', durationMin: 45 })
    expect(plan.source).toBe('deterministic')
    expect(plan.exercises.length).toBe(exerciseCountForDuration(45))
    expect(plan.exercises[0]?.order).toBe(1)
    expect(plan.exercises.every((e) => e.exerciseId && e.sets >= 2)).toBe(true)
  })

  it('parse une réponse IA JSON valide', () => {
    const fallback = buildDeterministicWorkout({ focus: 'Push', durationMin: 40 })
    const raw = JSON.stringify({
      title: 'Push Hypertrophy',
      exercises: [
        { exerciseId: 'bench_press', sets: 4, reps: 8, restSec: 120 },
        { exerciseId: 'incline_bench_press', sets: 3, reps: 10, restSec: 90 },
        { exerciseId: 'lateral_raise', sets: 3, reps: 12, restSec: 60 },
      ],
    })
    const parsed = parseAiWorkoutPlan(raw, fallback)
    expect(parsed?.source).toBe('ai')
    expect(parsed?.title).toBe('Push Hypertrophy')
    expect(parsed?.exercises).toHaveLength(3)
  })

  it('rejette une réponse IA hors catalogue', () => {
    const fallback = buildDeterministicWorkout({ focus: 'Push', durationMin: 40 })
    expect(
      parseAiWorkoutPlan(
        JSON.stringify({
          title: 'X',
          exercises: [{ exerciseId: 'unknown_move', sets: 3, reps: 10, restSec: 60 }],
        }),
        fallback,
      ),
    ).toBeNull()
  })
})
