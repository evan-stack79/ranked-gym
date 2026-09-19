import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseEntry, TrainingState, WorkoutRoutine } from '../types/training'
import { deriveTodayHubCard } from '../utils/trainHub'
import { liveElapsedMs } from '../utils/sessionClock'

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
  setActiveWorkoutPaused,
  persistActiveRestTimer,
  ensureActiveWorkoutClock,
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

  it('ne fabrique ni durée ni calories pour une séance non-lift sans mesure', async () => {
    const { saveWorkoutNote } = await import('./trainingStorage')

    saveWorkoutNote({
      title: 'Course sans mesure',
      sportId: 'course-a-pied',
      sessionKind: 'endurance',
      source: 'manual',
      estimatedKcal: 0,
      exercises: [
        {
          id: 'run',
          name: 'Course',
          sets: [{ reps: 42, weightKg: 0 }],
        },
      ],
    })

    const note = getTrainingState().workoutNotes[0]
    expect(note.durationMin).toBe(0)
    expect(note.estimatedKcal).toBe(0)
    expect(note.totalVolumeKg).toBe(0)
  })
})

describe('pause + repos persistés (clé Train)', () => {
  beforeEach(() => {
    store.clear()
    cloudUser.mockReturnValue(null)
  })

  function seedActiveBiceps() {
    const base = getTrainingState()
    const routines = [
      ...base.routines.filter((r) => r.id !== 'custom-biceps'),
      bicepsRoutine({
        exercises: [{ id: 'e1', name: 'Curl', sets: [{ reps: 10, weightKg: 12 }] }],
        updatedAt: 1,
      }),
    ]
    saveTrainingState({ ...base, routines })
    return startRoutineDraft('custom-biceps', 'musculation')
  }

  it('pause chronomètre survit à un rechargement localStorage', () => {
    expect(seedActiveBiceps().activeWorkoutDraft?.routineId).toBe('custom-biceps')
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000)
    setActiveWorkoutPaused(true)
    const paused = getTrainingState().activeWorkoutDraft
    expect(paused?.paused).toBe(true)
    expect(paused?.runningSince).toBeNull()

    const restored = getTrainingState().activeWorkoutDraft
    expect(restored?.paused).toBe(true)
    const t1 = liveElapsedMs(restored, 2_100_000)
    const t2 = liveElapsedMs(restored, 2_200_000)
    expect(t1).toBe(t2)

    setActiveWorkoutPaused(false)
    expect(getTrainingState().activeWorkoutDraft?.paused).toBe(false)
    expect(getTrainingState().activeWorkoutDraft?.runningSince).toBe(2_000_000)
    vi.restoreAllMocks()
  })

  it('minuteur de repos persisté : remaining via endsAt après refresh', () => {
    seedActiveBiceps()
    const endsAt = Date.now() + 45_000
    persistActiveRestTimer({
      totalSec: 90,
      remainingSec: 45,
      endsAt,
      paused: false,
      target: {
        exerciseId: 'e1',
        setIndex: 0,
        exerciseName: 'Curl',
        setLabel: 'Série 1',
      },
    })
    const snap = getTrainingState().activeWorkoutDraft?.restTimer
    expect(snap?.totalSec).toBe(90)
    expect(snap?.target.exerciseName).toBe('Curl')
    expect(snap?.endsAt).toBe(endsAt)

    persistActiveRestTimer({
      ...snap!,
      paused: true,
      remainingSec: 33,
    })
    expect(getTrainingState().activeWorkoutDraft?.restTimer?.paused).toBe(true)
    expect(getTrainingState().activeWorkoutDraft?.restTimer?.remainingSec).toBe(33)
  })

  it('ensureActiveWorkoutClock hydrate un brouillon legacy sans détruire la séance', () => {
    const base = getTrainingState()
    saveTrainingState({
      ...base,
      routines: [
        ...base.routines.filter((r) => r.id !== 'custom-biceps'),
        bicepsRoutine({
          exercises: [{ id: 'e1', name: 'Curl', sets: [{ reps: 10, weightKg: 12, done: true }] }],
          updatedAt: 1,
        }),
      ],
      activeWorkoutDraft: {
        routineId: 'custom-biceps',
        sportId: 'musculation',
        startedAt: 1_000_000,
        updatedAt: 1_000_000,
      },
    })
    vi.spyOn(Date, 'now').mockReturnValue(1_600_000)
    const next = ensureActiveWorkoutClock()
    expect(next.activeWorkoutDraft?.routineId).toBe('custom-biceps')
    // Mesure démarre à la reprise — pas startedAt
    expect(next.activeWorkoutDraft?.runningSince).toBe(1_600_000)
    expect(next.activeWorkoutDraft?.elapsedActiveMs).toBe(0)
    expect(next.activeWorkoutDraft?.estimatedElapsedMs).toBe(600_000)
    expect(next.activeWorkoutDraft?.startedAt).toBe(1_000_000)
    expect(deriveTodayHubCard(next, new Date('2026-09-04T15:00:00')).cta).toBe('resume')
    vi.restoreAllMocks()
  })

  it('changement de portée : rest timer guest non recopié vers compte', () => {
    cloudUser.mockReturnValue(null)
    seedActiveBiceps()
    persistActiveRestTimer({
      totalSec: 90,
      remainingSec: 40,
      endsAt: Date.now() + 40_000,
      paused: false,
      target: {
        exerciseId: 'e1',
        setIndex: 0,
        exerciseName: 'Curl',
        setLabel: 'Série 1',
      },
    })
    expect(getTrainingState().activeWorkoutDraft?.restTimer?.totalSec).toBe(90)

    cloudUser.mockReturnValue('user-account')
    // Nouvelle portée vide — pas de fuite du snapshot guest
    expect(getTrainingState().activeWorkoutDraft).toBeNull()
    expect(store.has('ranked-gym:training')).toBe(true)
    expect(store.has('ranked-gym:training:u:user-account')).toBe(false)
  })
})

describe('erreurs de sauvegarde visibles', () => {
  beforeEach(() => {
    store.clear()
    cloudUser.mockReturnValue(null)
  })

  it('émet une seule erreur locale puis propage l’échec de localStorage', () => {
    const events: string[] = []
    const listeners = new Map<string, Set<(event: Event) => void>>()
    const dispatchEvent = (event: Event) => {
      listeners.get(event.type)?.forEach((listener) => listener(event))
      return true
    }
    const addEventListener = (type: string, listener: (event: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    }
    const removeEventListener = (type: string, listener: (event: Event) => void) => {
      listeners.get(type)?.delete(listener)
    }
    vi.stubGlobal('dispatchEvent', dispatchEvent)
    vi.stubGlobal('addEventListener', addEventListener)
    vi.stubGlobal('removeEventListener', removeEventListener)

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ error?: string }>).detail
      events.push(detail?.error ?? '')
    }
    addEventListener('ranked-gym:training-persist-error', handler)

    const originalSetItem = localStorage.setItem.bind(localStorage)
    localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError')
    }

    try {
      expect(() => setLastSelectedRoutine('upper', 'musculation')).toThrow(/QuotaExceeded/)
      expect(events).toEqual(['QuotaExceededError'])
    } finally {
      localStorage.setItem = originalSetItem
      removeEventListener('ranked-gym:training-persist-error', handler)
      vi.unstubAllGlobals()
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => store.clear(),
      })
    }
  })
})

describe('soft-leave séance → Train (pas Abandonner)', () => {
  beforeEach(() => {
    store.clear()
    cloudUser.mockReturnValue(null)
    vi.useRealTimers()
  })

  function seedActiveBiceps() {
    const base = getTrainingState()
    const routines = [
      ...base.routines.filter((r) => r.id !== 'custom-biceps'),
      bicepsRoutine({
        exercises: [{ id: 'e1', name: 'Curl', sets: [{ reps: 10, weightKg: 12 }] }],
        updatedAt: 1,
      }),
    ]
    saveTrainingState({ ...base, routines })
    return startRoutineDraft('custom-biceps', 'musculation')
  }

  it('markVoluntaryLeave conserve le brouillon + empêche auto-reopen ; clear le permet', async () => {
    const {
      markVoluntaryLeaveToTrainHub,
      clearLastVoluntaryRoute,
      persistActiveExerciseIndex,
    } = await import('./trainingStorage')
    const { shouldAutoReopenSession } = await import('../utils/sessionBackNav')
    const { deriveTodayHubCard } = await import('../utils/trainHub')

    seedActiveBiceps()
    persistActiveExerciseIndex(1)
    const left = markVoluntaryLeaveToTrainHub()
    expect(left.lastVoluntaryRoute).toBe('train-hub')
    expect(left.activeWorkoutDraft?.routineId).toBe('custom-biceps')
    expect(left.activeWorkoutDraft?.activeExerciseIndex).toBe(1)
    expect(
      shouldAutoReopenSession({
        hasActiveDraft: true,
        lastVoluntaryRoute: left.lastVoluntaryRoute,
      }),
    ).toBe(false)

    const card = deriveTodayHubCard(left, new Date('2026-09-04T15:00:00'))
    expect(card.cta).toBe('resume')

    const cleared = clearLastVoluntaryRoute()
    expect(cleared.lastVoluntaryRoute).toBeNull()
    expect(cleared.activeWorkoutDraft?.activeExerciseIndex).toBe(1)
    expect(
      shouldAutoReopenSession({
        hasActiveDraft: true,
        lastVoluntaryRoute: cleared.lastVoluntaryRoute,
      }),
    ).toBe(true)
  })

  it('Terminer efface lastVoluntaryRoute + brouillon (plus de Reprendre)', async () => {
    const { markVoluntaryLeaveToTrainHub, saveWorkoutNote } = await import('./trainingStorage')
    seedActiveBiceps()
    markVoluntaryLeaveToTrainHub()
    saveWorkoutNote({
      title: 'Biceps',
      routineId: 'custom-biceps',
      sportId: 'musculation',
      sessionKind: 'strength',
      source: 'manual',
      estimatedKcal: 100,
      durationMin: 30,
      exercises: [
        {
          id: 'e1',
          name: 'Curl',
          sets: [{ reps: 10, weightKg: 12, done: true }],
        },
      ],
    })
    const after = getTrainingState()
    expect(after.activeWorkoutDraft).toBeNull()
    expect(after.lastVoluntaryRoute).toBeNull()
  })

  it('repos endsAt survit soft-leave (pas de wipe)', async () => {
    const { markVoluntaryLeaveToTrainHub, persistActiveRestTimer } = await import(
      './trainingStorage'
    )
    seedActiveBiceps()
    const endsAt = Date.now() + 45_000
    persistActiveRestTimer({
      totalSec: 90,
      remainingSec: 45,
      endsAt,
      paused: false,
      target: {
        exerciseId: 'e1',
        setIndex: 0,
        exerciseName: 'Curl',
        setLabel: 'S1',
      },
    })
    markVoluntaryLeaveToTrainHub()
    const snap = getTrainingState().activeWorkoutDraft?.restTimer
    expect(snap?.endsAt).toBe(endsAt)
    expect(snap?.remainingSec).toBe(45)
  })
})
