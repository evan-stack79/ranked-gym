import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkoutNote } from '../types/training'
import {
  buildEnduranceDetails,
  buildTeamDetails,
  emptyTeamSheetFields,
  manualSessionMeta,
  paceSecPerKmFromDuration,
  sessionKindForDiscipline,
} from './sessionMeta'

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

describe('paceSecPerKmFromDuration / buildEnduranceDetails', () => {
  it('calcule une allure correcte (30 min / 5 km = 360 s/km)', () => {
    expect(paceSecPerKmFromDuration(30, 5)).toBe(360)
  })

  it('rejette les entrées invalides sans NaN ni Infinity', () => {
    expect(paceSecPerKmFromDuration(0, 5)).toBeNull()
    expect(paceSecPerKmFromDuration(30, 0)).toBeNull()
    expect(paceSecPerKmFromDuration(-10, 5)).toBeNull()
    expect(paceSecPerKmFromDuration(30, -1)).toBeNull()
    expect(paceSecPerKmFromDuration(Number.NaN, 5)).toBeNull()
    expect(paceSecPerKmFromDuration(30, Number.POSITIVE_INFINITY)).toBeNull()
    expect(buildEnduranceDetails(0)).toBeNull()
    expect(buildEnduranceDetails(-2)).toBeNull()
    expect(buildEnduranceDetails(Number.NaN)).toBeNull()
    expect(buildEnduranceDetails(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('accepte une distance positive finie', () => {
    expect(buildEnduranceDetails(5)).toEqual({ kind: 'endurance', distanceKm: 5 })
  })
})

describe('saveWorkoutNote — métadonnées multisport additives', () => {
  beforeEach(() => {
    store.clear()
  })

  it('sauvegarde musculation sans details endurance', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    const meta = manualSessionMeta('musculation', 'strength')
    saveWorkoutNote({
      title: 'Push',
      exercises: [{ id: 'e1', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] }],
      estimatedKcal: 200,
      durationMin: 45,
      routineId: 'push',
      ...meta,
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.sportId).toBe('musculation')
    expect(note.sessionKind).toBe('strength')
    expect(note.source).toBe('manual')
    expect(note.details).toBeUndefined()
  })

  it('sauvegarde course avec distanceKm typé + durationMin', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    const meta = manualSessionMeta('course-a-pied', 'endurance')
    const details = buildEnduranceDetails(5)
    expect(details).not.toBeNull()
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
      details: details!,
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.sportId).toBe('course-a-pied')
    expect(note.sessionKind).toBe('endurance')
    expect(note.source).toBe('manual')
    expect(note.durationMin).toBe(30)
    expect(note.details).toEqual({ kind: 'endurance', distanceKm: 5 })
    expect(note.details?.kind).toBe('endurance')
    if (note.details?.kind === 'endurance') {
      expect(paceSecPerKmFromDuration(note.durationMin!, note.details.distanceKm)).toBe(360)
    }
    expect(note.exercises[0]?.name).toBe('5 km')
    expect(note.exercises[0]?.sets[0]?.reps).toBe(30)
  })

  it('sauvegarde vélo avec distanceKm typé', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    const meta = manualSessionMeta('velo', 'endurance')
    saveWorkoutNote({
      title: 'Vélo 40 km',
      exercises: [
        {
          id: 'endurance-bike',
          name: '40 km',
          sets: [{ reps: 90, weightKg: 0, difficulty: 'ok' }],
        },
      ],
      durationMin: 90,
      estimatedKcal: 700,
      ...meta,
      details: buildEnduranceDetails(40)!,
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.sportId).toBe('velo')
    expect(note.sessionKind).toBe('endurance')
    expect(note.durationMin).toBe(90)
    expect(note.details).toEqual({ kind: 'endurance', distanceKm: 40 })
    expect(paceSecPerKmFromDuration(90, 40)).toBe(135)
  })

  it('sauvegarde football legacy sans details team (toujours valide)', async () => {
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
    expect(note.sessionKind).toBe('team')
    expect(note.details).toBeUndefined()
  })

  it('sauvegarde générique (combat) sans details team ni endurance', async () => {
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
    expect(note.sessionKind).toBe('generic')
    expect(note.details).toBeUndefined()
  })

  it('lit une ancienne note sans details', async () => {
    const { saveTrainingState, getTrainingState } = await import('../services/trainingStorage')
    const legacy: WorkoutNote = {
      id: 'legacy-1',
      title: 'Old Push',
      dateKey: '2026-08-01',
      createdAt: 1,
      estimatedKcal: 180,
      exercises: [{ id: 'e0', name: 'Squat', sets: [{ reps: 5, weightKg: 100 }] }],
    }
    saveTrainingState({ ...getTrainingState(), workoutNotes: [legacy] })
    const loaded = getTrainingState().workoutNotes.find((n) => n.id === 'legacy-1')
    expect(loaded?.details).toBeUndefined()
    expect(loaded?.title).toBe('Old Push')
  })

  it('ne backfill pas details sur une note legacy à l’édition', async () => {
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
    expect(updated?.details).toBeUndefined()
  })

  it('changer primarySportId après coup ne modifie pas sportId ni details figés', async () => {
    const { saveWorkoutNote, setPrimarySport, getTrainingState } = await import(
      '../services/trainingStorage'
    )
    saveWorkoutNote({
      title: 'Course',
      exercises: [{ id: 'e', name: '5 km', sets: [{ reps: 28, weightKg: 0 }] }],
      durationMin: 28,
      estimatedKcal: 300,
      ...manualSessionMeta('course-a-pied', 'endurance'),
      details: buildEnduranceDetails(5)!,
    })
    const noteId = getTrainingState().workoutNotes[0].id
    setPrimarySport('football')
    const note = getTrainingState().workoutNotes.find((n) => n.id === noteId)
    expect(getTrainingState().primarySportId).toBe('football')
    expect(note?.sportId).toBe('course-a-pied')
    expect(note?.details).toEqual({ kind: 'endurance', distanceKm: 5 })
  })
})

describe('buildTeamDetails / emptyTeamSheetFields', () => {
  it('réinitialise le formulaire team aux valeurs par défaut', () => {
    expect(emptyTeamSheetFields()).toEqual({
      sessionType: 'training',
      minutesPlayed: null,
      position: '',
    })
  })

  it('sauvegarde un entraînement team correctement', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    const details = buildTeamDetails({
      sessionType: 'training',
      durationMin: 75,
      position: '  milieu  ',
    })
    expect(details).toEqual({
      kind: 'team',
      sessionType: 'training',
      position: 'milieu',
    })
    saveWorkoutNote({
      title: 'Football',
      exercises: [
        {
          id: 't1',
          name: 'Football',
          sets: [{ reps: 75, weightKg: 0, difficulty: 'ok' }],
        },
      ],
      durationMin: 75,
      estimatedKcal: 500,
      ...manualSessionMeta('football', 'team'),
      details: details!,
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.sessionKind).toBe('team')
    expect(note.details).toEqual({
      kind: 'team',
      sessionType: 'training',
      position: 'milieu',
    })
  })

  it('sauvegarde un match team avec minutes jouées valides', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    const details = buildTeamDetails({
      sessionType: 'match',
      durationMin: 95,
      minutesPlayed: 78,
      position: 'ailier',
    })
    expect(details).toEqual({
      kind: 'team',
      sessionType: 'match',
      minutesPlayed: 78,
      position: 'ailier',
    })
    saveWorkoutNote({
      title: 'Football',
      exercises: [
        {
          id: 't2',
          name: 'Football',
          sets: [{ reps: 95, weightKg: 0, difficulty: 'ok' }],
        },
      ],
      durationMin: 95,
      estimatedKcal: 600,
      ...manualSessionMeta('football', 'team'),
      details: details!,
    })
    const note = getTrainingState().workoutNotes[0]
    expect(note.durationMin).toBe(95)
    expect(note.details).toEqual({
      kind: 'team',
      sessionType: 'match',
      minutesPlayed: 78,
      position: 'ailier',
    })
  })

  it('refuse minutes invalides ou > durée', () => {
    expect(
      buildTeamDetails({ sessionType: 'match', durationMin: 60, minutesPlayed: 0 }),
    ).toBeNull()
    expect(
      buildTeamDetails({ sessionType: 'match', durationMin: 60, minutesPlayed: -5 }),
    ).toBeNull()
    expect(
      buildTeamDetails({ sessionType: 'match', durationMin: 60, minutesPlayed: 90 }),
    ).toBeNull()
    expect(
      buildTeamDetails({
        sessionType: 'match',
        durationMin: 60,
        minutesPlayed: Number.NaN,
      }),
    ).toBeNull()
    expect(
      buildTeamDetails({
        sessionType: 'match',
        durationMin: 60,
        minutesPlayed: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull()
  })

  it('convertit un poste vide / whitespace en omission', () => {
    expect(
      buildTeamDetails({ sessionType: 'training', durationMin: 40, position: '   ' }),
    ).toEqual({ kind: 'team', sessionType: 'training' })
    expect(
      buildTeamDetails({ sessionType: 'training', durationMin: 40, position: '' }),
    ).toEqual({ kind: 'team', sessionType: 'training' })
  })

  it('n’ajoute jamais de détail team sur strength / endurance', async () => {
    const { saveWorkoutNote, getTrainingState } = await import('../services/trainingStorage')
    store.clear()
    saveWorkoutNote({
      title: 'Push',
      exercises: [{ id: 'e', name: 'Bench', sets: [{ reps: 5, weightKg: 80 }] }],
      estimatedKcal: 100,
      durationMin: 40,
      ...manualSessionMeta('musculation', 'strength'),
    })
    expect(getTrainingState().workoutNotes[0].details).toBeUndefined()

    store.clear()
    saveWorkoutNote({
      title: 'Run',
      exercises: [{ id: 'e', name: '5 km', sets: [{ reps: 30, weightKg: 0 }] }],
      estimatedKcal: 200,
      durationMin: 30,
      ...manualSessionMeta('course-a-pied', 'endurance'),
      details: buildEnduranceDetails(5)!,
    })
    const run = getTrainingState().workoutNotes[0]
    expect(run.details?.kind).toBe('endurance')
    expect(run.details && 'sessionType' in run.details).toBe(false)
  })
})
