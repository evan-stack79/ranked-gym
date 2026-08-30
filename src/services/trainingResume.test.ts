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
