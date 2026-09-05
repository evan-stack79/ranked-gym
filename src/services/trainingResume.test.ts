import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseEntry, TrainingState, WorkoutRoutine } from '../types/training'

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

const cloudUser = vi.fn(() => null as string | null)

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => cloudUser(),
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

const {
  getTrainingState,
  saveRoutineDraft,
  saveTrainingState,
  sanitizeStoredId,
  setLastSelectedRoutine,
  setPrimarySport,
  resolveResumedRoutineId,
  startRoutineDraft,
  upsertSchedule,
} = await import('./trainingStorage')

function bicepsRoutine(overrides?: Partial<WorkoutRoutine>): WorkoutRoutine {
  return {
    id: 'custom-biceps',
    label: 'Biceps',
    subtitle: 'Focus bras',
    accent: '#BF5AF2',
    exercises: [],
    updatedAt: 0,
    ...overrides,
  }
}

function withBiceps(state?: Partial<TrainingState>): TrainingState {
  const base = getTrainingState()
  const existing = base.routines.filter((r) => r.id !== 'custom-biceps')
  return {
    ...base,
    ...state,
    routines: [...existing, bicepsRoutine()],
  }
}

describe('sanitizeStoredId', () => {
  it('rejette ID corrompu sans crash', () => {
    expect(sanitizeStoredId(undefined)).toBeNull()
    expect(sanitizeStoredId(null)).toBeNull()
    expect(sanitizeStoredId(42)).toBeNull()
    expect(sanitizeStoredId('')).toBeNull()
    expect(sanitizeStoredId('   ')).toBeNull()
    expect(sanitizeStoredId('a'.repeat(200))).toBeNull()
    expect(sanitizeStoredId('bad\u0000id')).toBeNull()
    expect(sanitizeStoredId('custom-biceps')).toBe('custom-biceps')
  })
})

describe('reprise contexte Training (YouTube-like)', () => {
  beforeEach(() => {
    store.clear()
    cloudUser.mockReturnValue(null)
  })

  it('1. sélection Biceps → sauvegarde immédiate (pas seulement à la fermeture)', () => {
    saveTrainingState(withBiceps())
    const next = setLastSelectedRoutine('custom-biceps', 'musculation')
    expect(next.lastSelectedRoutineId).toBe('custom-biceps')
    expect(next.lastSelectedSportId).toBe('musculation')
    // Relu depuis localStorage comme après changement d’onglet / remount
    expect(getTrainingState().lastSelectedRoutineId).toBe('custom-biceps')
  })

  it('2. visibilitychange hidden/visible → préférence toujours là', () => {
    saveTrainingState(withBiceps())
    setLastSelectedRoutine('custom-biceps', 'musculation')
    // Cycle arrière-plan : la préférence est déjà en storage (pas d’écriture au hide).
    expect(getTrainingState().lastSelectedRoutineId).toBe('custom-biceps')
    expect(
      resolveResumedRoutineId({
        routines: getTrainingState().routines,
        candidateIds: ['upper', 'lower', 'full', 'custom-biceps'],
        sportId: 'musculation',
      }),
    ).toBe('custom-biceps')
  })

  it('3. pagehide → nouveau montage → Biceps restauré', () => {
    saveTrainingState(withBiceps())
    setLastSelectedRoutine('custom-biceps', 'musculation')
    // Remount après pagehide = relecture storage + resolve
    const resumed = resolveResumedRoutineId({
      routines: getTrainingState().routines,
      candidateIds: ['upper', 'lower', 'full', 'custom-biceps'],
      sportId: 'musculation',
    })
    expect(resumed).toBe('custom-biceps')
  })

  it('4. rechargement complet (relecture storage) → Biceps restauré', () => {
    saveTrainingState(withBiceps())
    setLastSelectedRoutine('custom-biceps', 'musculation')
    const raw = store.get('ranked-gym:training')
    expect(raw).toBeTruthy()
    store.clear()
    store.set('ranked-gym:training', raw!)
    expect(getTrainingState().lastSelectedRoutineId).toBe('custom-biceps')
    expect(
      resolveResumedRoutineId({
        routines: getTrainingState().routines,
        candidateIds: ['custom-biceps', 'upper'],
        sportId: 'musculation',
      }),
    ).toBe('custom-biceps')
  })

  it('5. brouillon kg/reps conservé avec la préférence', () => {
    saveTrainingState(withBiceps())
    setLastSelectedRoutine('custom-biceps', 'musculation')
    const draft: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Curl barre',
        sets: [
          { reps: 10, weightKg: 30, done: true },
          { reps: 8, weightKg: 32.5 },
        ],
      },
    ]
    saveRoutineDraft('custom-biceps', draft)
    const state = getTrainingState()
    expect(state.lastSelectedRoutineId).toBe('custom-biceps')
    const routine = state.routines.find((r) => r.id === 'custom-biceps')
    expect(routine?.exercises[0]?.name).toBe('Curl barre')
    expect(routine?.exercises[0]?.sets[0]?.weightKg).toBe(30)
    expect(routine?.exercises[0]?.sets[1]?.reps).toBe(8)
    expect(state.activeWorkoutDraft).toMatchObject({
      routineId: 'custom-biceps',
      sportId: 'musculation',
    })
  })

  it('6. routine supprimée → fallback propre', () => {
    saveTrainingState(withBiceps())
    setLastSelectedRoutine('custom-biceps', 'musculation')
    const state = getTrainingState()
    saveTrainingState({
      ...state,
      routines: state.routines.filter((r) => r.id !== 'custom-biceps'),
    })
    const resumed = resolveResumedRoutineId({
      routines: getTrainingState().routines,
      candidateIds: ['upper', 'lower', 'full'],
      sportId: 'musculation',
    })
    expect(resumed).toBe('upper')
  })

  it('7. ID corrompu en storage → aucun crash, fallback', () => {
    store.set(
      'ranked-gym:training',
      JSON.stringify({
        primarySportId: 'musculation',
        favoriteSportIds: ['musculation'],
        lastSelectedRoutineId: { evil: true },
        lastSelectedSportId: 99,
        routines: [],
      }),
    )
    const state = getTrainingState()
    expect(state.lastSelectedRoutineId).toBeNull()
    expect(state.lastSelectedSportId).toBeNull()
    expect(state.activeWorkoutDraft).toBeNull()
    expect(
      resolveResumedRoutineId({
        routines: state.routines,
        candidateIds: ['upper', 'lower'],
        sportId: 'musculation',
      }),
    ).toBe('upper')
  })

  it('8. changement de sport → aucun contexte incompatible', () => {
    saveTrainingState(withBiceps())
    setLastSelectedRoutine('custom-biceps', 'musculation')
    setPrimarySport('football')
    const state = getTrainingState()
    expect(state.lastSelectedRoutineId).toBeNull()
    expect(state.lastSelectedSportId).toBeNull()
    expect(state.primarySportId).toBe('football')
  })

  it('8b. sport mismatch stocké → resolve ignore la préférence', () => {
    saveTrainingState({
      ...withBiceps(),
      lastSelectedRoutineId: 'custom-biceps',
      lastSelectedSportId: 'musculation',
      primarySportId: 'musculation',
    })
    // sport courant ≠ stocké → fallback premier candidat
    expect(
      resolveResumedRoutineId({
        routines: getTrainingState().routines,
        candidateIds: ['upper', 'custom-biceps'],
        sportId: 'course',
      }),
    ).toBe('upper')
  })

  it('9. changement de compte → aucune fuite', () => {
    cloudUser.mockReturnValue('user-a')
    saveTrainingState(withBiceps())
    setLastSelectedRoutine('custom-biceps', 'musculation')
    expect(store.has('ranked-gym:training:u:user-a')).toBe(true)
    expect(getTrainingState().lastSelectedRoutineId).toBe('custom-biceps')

    cloudUser.mockReturnValue('user-b')
    expect(getTrainingState().lastSelectedRoutineId).toBeNull()
    setLastSelectedRoutine('upper', 'musculation')
    expect(getTrainingState().lastSelectedRoutineId).toBe('upper')

    cloudUser.mockReturnValue('user-a')
    expect(getTrainingState().lastSelectedRoutineId).toBe('custom-biceps')
  })

  it('10. données anciennes sans préférence toujours valides', () => {
    store.set(
      'ranked-gym:training',
      JSON.stringify({
        primarySportId: 'musculation',
        favoriteSportIds: ['musculation'],
        stepsToday: 1000,
        stepsDateKey: '2099-01-01',
        healthLinked: false,
        notificationsEnabled: false,
        templates: [],
        schedule: [],
        completed: [],
        workoutNotes: [],
        routines: [
          { id: 'upper', label: 'Upper', subtitle: '', accent: '#f00', exercises: [], updatedAt: 0 },
        ],
      }),
    )
    const state = getTrainingState()
    expect(state.lastSelectedRoutineId).toBeNull()
    expect(state.lastSelectedSportId).toBeNull()
    expect(state.routines.some((r) => r.id === 'upper')).toBe(true)
    expect(
      resolveResumedRoutineId({
        routines: state.routines,
        candidateIds: ['upper', 'lower'],
        sportId: 'musculation',
      }),
    ).toBe('upper')
  })

  it('launchRoutineId prime sur la dernière sélection', () => {
    saveTrainingState({
      ...withBiceps(),
      lastSelectedRoutineId: 'custom-biceps',
      lastSelectedSportId: 'musculation',
    })
    expect(
      resolveResumedRoutineId({
        routines: getTrainingState().routines,
        candidateIds: ['upper', 'lower', 'custom-biceps'],
        sportId: 'musculation',
        launchRoutineId: 'lower',
      }),
    ).toBe('lower')
  })
})

describe('planning typé et brouillon actif rétrocompatibles', () => {
  beforeEach(() => {
    store.clear()
    cloudUser.mockReturnValue(null)
  })

  it('fige sportId/sessionKind sur un nouveau créneau et corrige un kind incohérent', () => {
    upsertSchedule({
      templateId: 'notebook', title: 'Course', days: [5], time: '18:00', enabled: true,
      sportId: 'course-a-pied', sessionKind: 'strength',
    })
    expect(getTrainingState().schedule[0]).toMatchObject({
      sportId: 'course-a-pied', sessionKind: 'endurance', templateId: 'notebook',
    })
  })

  it('relit un ancien créneau sans inventer de métadonnée', () => {
    store.set('ranked-gym:training', JSON.stringify({
      ...withBiceps(),
      schedule: [{
        id: 'legacy', templateId: 'notebook', title: 'Ancien', days: [5],
        time: '18:00', enabled: true,
      }],
    }))
    const legacy = getTrainingState().schedule[0]
    expect(legacy.sportId).toBeUndefined()
    expect(legacy.sessionKind).toBeUndefined()
  })

  it('ignore les done legacy et les marqueurs actifs invalides sans supprimer les séries', () => {
    const state = withBiceps()
    const routines = state.routines.map((routine) => routine.id === 'custom-biceps'
      ? bicepsRoutine({
          exercises: [{ id: 'e', name: 'Curl', sets: [{ reps: 8, weightKg: 20, done: true }] }],
        })
      : routine)
    store.set('ranked-gym:training', JSON.stringify({
      ...state,
      routines,
      activeWorkoutDraft: { routineId: 'missing', sportId: 'musculation', startedAt: 1, updatedAt: 2 },
    }))
    const restored = getTrainingState()
    expect(restored.activeWorkoutDraft).toBeNull()
    expect(restored.routines.find((routine) => routine.id === 'custom-biceps')
      ?.exercises[0].sets[0].done).toBe(true)
  })

  it('Démarrer refuse une routine vide et marque une routine valide sans toucher ses données', () => {
    saveTrainingState(withBiceps())
    expect(startRoutineDraft('custom-biceps', 'musculation').activeWorkoutDraft).toBeNull()

    const state = getTrainingState()
    saveTrainingState({
      ...state,
      routines: state.routines.map((routine) => routine.id === 'custom-biceps'
        ? bicepsRoutine({ exercises: [{ id: 'e', name: 'Curl', sets: [{ reps: 8, weightKg: 20 }] }] })
        : routine),
    })
    const before = structuredClone(getTrainingState().routines)
    const started = startRoutineDraft('custom-biceps', 'musculation')
    expect(started.activeWorkoutDraft).toMatchObject({
      routineId: 'custom-biceps', sportId: 'musculation',
    })
    expect(started.routines).toEqual(before)
  })
})

describe('fin de séance — plus de Reprendre', () => {
  beforeEach(() => {
    store.clear()
    cloudUser.mockReturnValue(null)
  })

  it('saveWorkoutNote nettoie done/restSec : séance terminée ne redevient jamais Reprendre', async () => {
    const { deriveTodayHubCard } = await import('../utils/trainHub')
    const { saveWorkoutNote, stripTransientSetMarkers } = await import('./trainingStorage')

    const cleaned = stripTransientSetMarkers([
      {
        id: 'e1',
        name: 'Curl',
        sets: [{ reps: 10, weightKg: 12, done: true, restSec: 90 }],
      },
    ])
    expect(cleaned[0].sets[0].done).toBeUndefined()
    expect(cleaned[0].sets[0].restSec).toBeUndefined()
    expect(cleaned[0].sets[0].reps).toBe(10)

    saveTrainingState({
      ...getTrainingState(),
      routines: [
        ...getTrainingState().routines.filter((r) => r.id !== 'custom-biceps'),
        bicepsRoutine({
          exercises: [
            {
              id: 'e1',
              name: 'Curl',
              sets: [
                { reps: 10, weightKg: 12, done: true, restSec: 60 },
                { reps: 10, weightKg: 12 },
              ],
            },
          ],
          updatedAt: Date.now(),
        }),
      ],
      lastSelectedRoutineId: 'custom-biceps',
      lastSelectedSportId: 'musculation',
      activeWorkoutDraft: {
        routineId: 'custom-biceps',
        sportId: 'musculation',
        startedAt: Date.now() - 1_000,
        updatedAt: Date.now(),
      },
    })

    const before = deriveTodayHubCard(getTrainingState(), new Date('2026-09-04T15:00:00'))
    expect(before.cta).toBe('resume')

    saveWorkoutNote({
      title: 'Biceps',
      routineId: 'custom-biceps',
      sportId: 'musculation',
      sessionKind: 'strength',
      source: 'manual',
      estimatedKcal: 180,
      durationMin: 40,
      exercises: [
        {
          id: 'e1',
          name: 'Curl',
          sets: [
            { reps: 10, weightKg: 12, done: true, restSec: 60 },
            { reps: 10, weightKg: 12, done: true },
          ],
        },
      ],
    })

    const after = getTrainingState()
    expect(after.activeWorkoutDraft).toBeNull()
    const routine = after.routines.find((r) => r.id === 'custom-biceps')
    expect(routine?.exercises.every((e) => e.sets.every((s) => s.done !== true))).toBe(true)
    const card = deriveTodayHubCard(after, new Date('2026-09-04T15:00:00'))
    expect(card.cta).not.toBe('resume')
  })
})
