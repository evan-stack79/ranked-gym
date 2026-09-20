import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeStrengthSessionStats } from '../utils/strength'

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v)
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
  clear: () => store.clear(),
})

vi.mock('./cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => null,
}))

vi.mock('./nutritionStorage', () => ({
  getCalorieProfile: vi.fn(() => ({
    weightKg: 75,
    goalWeightKg: 75,
    heightCm: 175,
    age: 28,
    sex: 'male',
    activity: 'moderate',
    morphology: 'mesomorph',
    goal: 'maintain',
    weeklyPaceKg: 0,
    onboardingComplete: true,
  })),
}))

const { saveWorkoutNote, getTrainingState, saveTrainingState } = await import('./trainingStorage')

const squatEx = {
  id: 'e-squat',
  name: 'Squat',
  canonicalExerciseId: 'back_squat' as const,
  sets: [{ reps: 5, weightKg: 100 }],
}
const benchEx = {
  id: 'e-bench',
  name: 'Développé couché',
  canonicalExerciseId: 'bench_press' as const,
  sets: [{ reps: 8, weightKg: 60 }],
}

describe('saveWorkoutNote — titres de séance', () => {
  beforeEach(() => {
    store.clear()
  })

  it('nouvelle séance Squat n’hérite plus « Biceps »', () => {
    saveWorkoutNote({
      title: 'Biceps',
      exercises: [squatEx],
      estimatedKcal: 1,
      sessionKind: 'strength',
      sportId: 'musculation',
      source: 'manual',
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.title).toBe('Squat')
    expect(note.titleSource).toBe('derived')
    expect(note.title).not.toBe('Biceps')
  })

  it('nouvelle séance Développé couché → titre réel', () => {
    saveWorkoutNote({
      title: 'Biceps',
      exercises: [benchEx],
      estimatedKcal: 1,
      sessionKind: 'strength',
      sportId: 'musculation',
    })
    expect(getTrainingState().workoutNotes[0].title).toBe('Développé couché')
  })

  it('plusieurs exercices → Séance musculation', () => {
    saveWorkoutNote({
      title: 'Biceps',
      exercises: [squatEx, benchEx],
      estimatedKcal: 1,
      sessionKind: 'strength',
    })
    expect(getTrainingState().workoutNotes[0].title).toBe('Séance musculation')
  })

  it('nom personnalisé titleSource=user → conservé', () => {
    saveWorkoutNote({
      title: 'Push du soir',
      titleSource: 'user',
      exercises: [squatEx],
      estimatedKcal: 1,
      sessionKind: 'strength',
    })
    expect(getTrainingState().workoutNotes[0].title).toBe('Push du soir')
    expect(getTrainingState().workoutNotes[0].titleSource).toBe('user')
  })

  it('reload → titre inchangé', () => {
    saveWorkoutNote({
      title: 'Biceps',
      exercises: [squatEx],
      estimatedKcal: 1,
      sessionKind: 'strength',
    })
    const first = getTrainingState().workoutNotes[0].title
    expect(getTrainingState().workoutNotes[0].title).toBe(first)
    expect(first).toBe('Squat')
  })

  it('édition d’une ancienne note Biceps → pas de migration destructive', () => {
    const planted = getTrainingState()
    saveTrainingState({
      ...planted,
      workoutNotes: [
        {
          id: 'legacy-biceps',
          title: 'Biceps',
          dateKey: '2026-09-01',
          createdAt: 1_000,
          estimatedKcal: 96,
          durationMin: 15,
          totalVolumeKg: 500,
          sessionKind: 'strength',
          exercises: [squatEx],
        },
      ],
    })

    saveWorkoutNote({
      id: 'legacy-biceps',
      createdAt: 1_000,
      dateKey: '2026-09-01',
      title: 'Biceps',
      exercises: [squatEx],
      estimatedKcal: 96,
      sessionKind: 'strength',
    })
    const note = getTrainingState().workoutNotes.find((n) => n.id === 'legacy-biceps')
    expect(note?.title).toBe('Biceps')
  })

  it('no-reg volume / durée / kcal / exercices', () => {
    const expected = computeStrengthSessionStats([squatEx], 75)
    saveWorkoutNote({
      title: 'Biceps',
      exercises: [squatEx],
      estimatedKcal: 1,
      durationMin: expected.durationMin,
      sessionKind: 'strength',
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.exercises).toEqual([squatEx])
    expect(note.totalVolumeKg).toBe(expected.volume)
    expect(note.durationMin).toBe(expected.durationMin)
    expect(note.estimatedKcal).toBe(expected.kcal)
    expect(note.totalVolumeKg).toBe(500)
  })

  it('historique existant reste accessible à côté d’une nouvelle séance', () => {
    saveTrainingState({
      ...getTrainingState(),
      workoutNotes: [
        {
          id: 'old',
          title: 'Ancienne',
          dateKey: '2026-09-01',
          createdAt: 10,
          estimatedKcal: 80,
          exercises: [benchEx],
        },
      ],
    })
    saveWorkoutNote({
      title: 'Biceps',
      exercises: [squatEx],
      estimatedKcal: 1,
      sessionKind: 'strength',
    })
    const notes = getTrainingState().workoutNotes
    expect(notes.some((n) => n.id === 'old' && n.title === 'Ancienne')).toBe(true)
    expect(notes.some((n) => n.title === 'Squat')).toBe(true)
  })
})
