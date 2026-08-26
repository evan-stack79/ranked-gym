import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkoutNote } from '../types/training'
import { manualSessionMeta, sessionKindForDiscipline } from './sessionMeta'

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

vi.mock('../services/cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

vi.mock('../services/cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

vi.mock('../services/nutritionStorage', () => ({
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

describe('sessionKindForDiscipline', () => {
  it('mappe carnet force / hybrid → strength', () => {
    expect(sessionKindForDiscipline('musculation')).toBe('strength')
    expect(sessionKindForDiscipline('crossfit')).toBe('strength')
    expect(sessionKindForDiscipline('fitness')).toBe('strength')
  })

  it('mappe course / vélo → endurance', () => {
    expect(sessionKindForDiscipline('course')).toBe('endurance')
    expect(sessionKindForDiscipline('cyclisme')).toBe('endurance')
  })

  it('mappe football → team et combat → generic', () => {
    expect(sessionKindForDiscipline('football')).toBe('team')
    expect(sessionKindForDiscipline('combat')).toBe('generic')
  })
})

describe('saveWorkoutNote — métadonnées multisport additives', () => {
  beforeEach(() => {
    store.clear()
  })

  it('sauvegarde musculation avec sportId, strength, manual', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    const meta = manualSessionMeta('musculation', 'strength')
    saveWorkoutNote({
      title: 'Push',
      exercises: [
        { id: 'e1', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] },
      ],
      estimatedKcal: 200,
      durationMin: 45,
      routineId: 'push',
      ...meta,
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.sportId).toBe('musculation')
    expect(note.sessionKind).toBe('strength')
    expect(note.source).toBe('manual')
  })

  it('sauvegarde endurance avec sportId, endurance, manual', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    const meta = manualSessionMeta('course-a-pied', 'endurance')
    saveWorkoutNote({
      title: 'Course 5 km',
      exercises: [
        {
          id: 'endurance-1',
          name: '5 km',
          sets: [{ reps: 30, weightKg: 0, difficulty: 'ok' }],
        },
      ],
      durationMin: 30,
      estimatedKcal: 320,
      ...meta,
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.sportId).toBe('course-a-pied')
    expect(note.sessionKind).toBe('endurance')
    expect(note.source).toBe('manual')
  })

  it('sauvegarde football avec sportId, team, manual', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    const meta = manualSessionMeta('football', 'team')
    saveWorkoutNote({
      title: 'Football',
      exercises: [
        {
          id: 'cardio-1',
          name: 'Football',
          sets: [{ reps: 60, weightKg: 0, difficulty: 'ok' }],
        },
      ],
      durationMin: 60,
      estimatedKcal: 400,
      ...meta,
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.sportId).toBe('football')
    expect(note.sessionKind).toBe('team')
    expect(note.source).toBe('manual')
  })

  it('sauvegarde générique (combat) avec sportId, generic, manual', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    const meta = manualSessionMeta('boxe', 'generic')
    saveWorkoutNote({
      title: 'Boxe',
      exercises: [
        {
          id: 'cardio-2',
          name: 'Boxe',
          sets: [{ reps: 45, weightKg: 0, difficulty: 'ok' }],
        },
      ],
      durationMin: 45,
      estimatedKcal: 350,
      ...meta,
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.sportId).toBe('boxe')
    expect(note.sessionKind).toBe('generic')
    expect(note.source).toBe('manual')
  })

  it('lit une ancienne note sans les nouveaux champs', async () => {
    const { saveTrainingState, getTrainingState } = await import('../services/trainingStorage')
    const legacy: WorkoutNote = {
      id: 'legacy-1',
      title: 'Old Push',
      dateKey: '2026-08-01',
      createdAt: 1,
      estimatedKcal: 180,
      exercises: [{ id: 'e0', name: 'Squat', sets: [{ reps: 5, weightKg: 100 }] }],
    }
    const state = getTrainingState()
    saveTrainingState({ ...state, workoutNotes: [legacy] })

    const loaded = getTrainingState().workoutNotes.find((n) => n.id === 'legacy-1')
    expect(loaded).toBeDefined()
    expect(loaded?.sportId).toBeUndefined()
    expect(loaded?.sessionKind).toBeUndefined()
    expect(loaded?.source).toBeUndefined()
    expect(loaded?.title).toBe('Old Push')
  })

  it('ne backfill pas les métadonnées sur une note legacy à l’édition', async () => {
    const { saveTrainingState, saveWorkoutNote, getTrainingState } = await import(
      '../services/trainingStorage'
    )
    const legacy: WorkoutNote = {
      id: 'legacy-2',
      title: 'Legacy',
      dateKey: '2026-08-02',
      createdAt: 2,
      estimatedKcal: 150,
      exercises: [{ id: 'e0', name: 'Row', sets: [{ reps: 8, weightKg: 40 }] }],
    }
    saveTrainingState({ ...getTrainingState(), workoutNotes: [legacy] })

    // Édition sans passer sportId/sessionKind/source (comme WorkoutNotebook legacy)
    saveWorkoutNote({
      id: 'legacy-2',
      createdAt: 2,
      dateKey: '2026-08-02',
      title: 'Legacy edited',
      exercises: [{ id: 'e0', name: 'Row', sets: [{ reps: 8, weightKg: 42.5 }] }],
      estimatedKcal: 160,
      durationMin: 40,
      totalVolumeKg: 340,
    })

    const updated = getTrainingState().workoutNotes.find((n) => n.id === 'legacy-2')
    expect(updated?.title).toBe('Legacy edited')
    expect(updated?.sportId).toBeUndefined()
    expect(updated?.sessionKind).toBeUndefined()
    expect(updated?.source).toBeUndefined()
  })

  it('changer primarySportId après coup ne modifie pas le sportId figé', async () => {
    const { saveWorkoutNote, setPrimarySport, getTrainingState } = await import(
      '../services/trainingStorage'
    )
    saveWorkoutNote({
      title: 'Course',
      exercises: [
        {
          id: 'e',
          name: '5 km',
          sets: [{ reps: 28, weightKg: 0 }],
        },
      ],
      durationMin: 28,
      estimatedKcal: 300,
      ...manualSessionMeta('course-a-pied', 'endurance'),
    })
    const noteId = getTrainingState().workoutNotes[0].id
    setPrimarySport('football')
    const note = getTrainingState().workoutNotes.find((n) => n.id === noteId)
    expect(getTrainingState().primarySportId).toBe('football')
    expect(note?.sportId).toBe('course-a-pied')
    expect(note?.sessionKind).toBe('endurance')
  })
})
