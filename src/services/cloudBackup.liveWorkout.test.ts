import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveWorkoutDraft, TrainingState, WorkoutNote, WorkoutRoutine } from '../types/training'
import type { CloudBackupPayload } from './cloudBackup'

const mockFetchConvexBackupPayload = vi.fn()
const mockPushConvexBackupPayload = vi.fn()

vi.mock('../backend/adapter', () => ({
  isActiveCloudBackendConfigured: () => true,
  isConvexDomainActive: () => true,
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabase: () => {
    throw new Error('Supabase should not be called in Convex primary live-workout tests')
  },
}))

vi.mock('./convexCloudBackup', () => ({
  fetchConvexBackupPayload: (...args: unknown[]) => mockFetchConvexBackupPayload(...args),
  pushConvexBackupPayload: (...args: unknown[]) => mockPushConvexBackupPayload(...args),
}))

function routine(id: string, name: string, updatedAt: number, extra?: Partial<WorkoutRoutine>): WorkoutRoutine {
  return {
    id,
    label: name,
    subtitle: '',
    accent: '#FF2B2B',
    updatedAt,
    exercises: [
      {
        id: `ex-${id}`,
        name,
        sets: [{ reps: 8, weightKg: 40, done: true, rpe: 7 }],
      },
    ],
    ...extra,
  }
}

function note(partial: Partial<WorkoutNote> & Pick<WorkoutNote, 'id' | 'createdAt'>): WorkoutNote {
  return {
    title: 'Séance',
    dateKey: '2026-09-28',
    exercises: [],
    estimatedKcal: 100,
    ...partial,
  }
}

function draft(partial: Partial<ActiveWorkoutDraft> & Pick<ActiveWorkoutDraft, 'updatedAt' | 'startedAt'>): ActiveWorkoutDraft {
  return {
    routineId: 'live-free',
    sportId: 'musculation',
    ...partial,
  }
}

describe('cloudBackup live workout resume (C3)', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    mockFetchConvexBackupPayload.mockReset()
    mockPushConvexBackupPayload.mockReset()
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
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.useRealTimers()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function load() {
    const session = await import('./cloudSession')
    session.setActiveCloudUserId('user-live')
    const training = await import('./trainingStorage')
    const cloud = await import('./cloudBackup')
    cloud.setCloudBackupUserId('user-live')
    return { session, training, cloud }
  }

  function seedLive(
    training: typeof import('./trainingStorage'),
    input: {
      draft: ActiveWorkoutDraft
      liveRoutine: WorkoutRoutine
      notes?: WorkoutNote[]
    },
  ): TrainingState {
    const next: TrainingState = {
      ...training.getTrainingState(),
      workoutNotes: input.notes ?? [],
      routines: [
        ...training.getTrainingState().routines.filter((item) => item.id !== input.liveRoutine.id),
        input.liveRoutine,
      ],
      activeWorkoutDraft: input.draft,
      lastVoluntaryRoute: null,
    }
    training.saveTrainingState(next, { skipCloud: true })
    return training.getTrainingState()
  }

  function remotePayload(
    cloud: typeof import('./cloudBackup'),
    training: TrainingState,
  ): CloudBackupPayload {
    const payload = cloud.collectLocalBackup()
    return { ...payload, training }
  }

  it('applyBackup conserve un brouillon live local plus récent et sa routine', async () => {
    const { training, cloud } = await load()
    const localRoutine = routine('live-free', 'Musculation locale', 5_000, {
      exercises: [
        {
          id: 'ex-local',
          name: 'Curl',
          sets: [
            { reps: 10, weightKg: 12, done: true, rpe: 8 },
            { reps: 10, weightKg: 12, done: true, rpe: 8 },
          ],
        },
      ],
    })
    const remoteRoutine = routine('live-free', 'Musculation distante', 2_000, {
      exercises: [
        {
          id: 'ex-remote',
          name: 'Curl',
          sets: [{ reps: 10, weightKg: 12, done: false }],
        },
      ],
    })

    const local = seedLive(training, {
      draft: draft({ startedAt: 1_000, updatedAt: 5_000, activeExerciseIndex: 2 }),
      liveRoutine: localRoutine,
    })

    const remoteTraining: TrainingState = {
      ...local,
      activeWorkoutDraft: draft({ startedAt: 1_000, updatedAt: 2_000, activeExerciseIndex: 0 }),
      routines: local.routines.map((item) => (item.id === 'live-free' ? remoteRoutine : item)),
    }

    cloud.applyCloudBackupPayload(remotePayload(cloud, remoteTraining))

    const after = training.getTrainingState()
    expect(after.activeWorkoutDraft?.updatedAt).toBe(5_000)
    expect(after.activeWorkoutDraft?.activeExerciseIndex).toBe(2)
    const kept = after.routines.find((item) => item.id === 'live-free')
    expect(kept?.exercises[0]?.sets.filter((set) => set.done).length).toBe(2)
    expect(kept?.exercises[0]?.id).toBe('ex-local')
  })

  it('applyBackup ne ressuscite pas un brouillon déjà clos à distance (même startedAt)', async () => {
    const { training, cloud } = await load()
    const localRoutine = routine('live-free', 'Locale', 9_000)
    const finished = note({
      id: 'note-closed',
      createdAt: 1_000,
      routineId: 'live-free',
      title: 'Séance terminée',
    })

    seedLive(training, {
      draft: draft({ startedAt: 1_000, updatedAt: 9_000, activeExerciseIndex: 2 }),
      liveRoutine: localRoutine,
    })

    const remoteTraining: TrainingState = {
      ...training.getTrainingState(),
      activeWorkoutDraft: null,
      workoutNotes: [finished],
      routines: training.getTrainingState().routines.map((item) =>
        item.id === 'live-free' ? routine('live-free', 'Après cloture', 1_000) : item,
      ),
    }

    cloud.applyCloudBackupPayload(remotePayload(cloud, remoteTraining))

    const after = training.getTrainingState()
    expect(after.activeWorkoutDraft).toBeNull()
    expect(after.workoutNotes.some((item) => item.id === 'note-closed')).toBe(true)
  })

  it('applyBackup ne ressuscite pas si le cloud n’a plus de brouillon mais une note plus récente', async () => {
    const { training, cloud } = await load()
    seedLive(training, {
      draft: draft({ startedAt: 1_000, updatedAt: 2_000, activeExerciseIndex: 1 }),
      liveRoutine: routine('live-free', 'Locale', 2_000),
    })

    const remoteTraining: TrainingState = {
      ...training.getTrainingState(),
      activeWorkoutDraft: null,
      workoutNotes: [
        note({
          id: 'note-newer',
          createdAt: 4_000,
          routineId: 'live-free',
          title: 'Séance cloud',
        }),
      ],
    }

    cloud.applyCloudBackupPayload(remotePayload(cloud, remoteTraining))
    expect(training.getTrainingState().activeWorkoutDraft).toBeNull()
  })

  it('pullCloudBackup conserve le live local plus récent', async () => {
    const { training, cloud } = await load()
    const localRoutine = routine('live-free', 'Musculation locale', 8_000)
    const local = seedLive(training, {
      draft: draft({ startedAt: 1_000, updatedAt: 8_000, activeExerciseIndex: 3 }),
      liveRoutine: localRoutine,
    })

    const remoteTraining: TrainingState = {
      ...local,
      activeWorkoutDraft: draft({ startedAt: 1_000, updatedAt: 3_000, activeExerciseIndex: 0 }),
      routines: local.routines.map((item) =>
        item.id === 'live-free' ? routine('live-free', 'Copie cloud', 3_000) : item,
      ),
    }

    mockFetchConvexBackupPayload.mockResolvedValue({
      payload: remotePayload(cloud, remoteTraining),
      error: undefined,
      serverVersion: 1,
    })

    const result = await cloud.pullCloudBackup('user-live', { preferRemote: true })
    expect(result.ok).toBe(true)
    expect(result.applied).toBe(true)
    const after = training.getTrainingState()
    expect(after.activeWorkoutDraft?.updatedAt).toBe(8_000)
    expect(after.activeWorkoutDraft?.activeExerciseIndex).toBe(3)
    expect(after.routines.find((item) => item.id === 'live-free')?.label).toBe('Musculation locale')
  })

  it('sessionId : même séance live — updatedAt départage uniquement ces deux versions', async () => {
    const { training, cloud } = await load()
    const sessionId = '11111111-1111-4111-8111-111111111111'
    const localRoutine = routine('live-free', 'Musculation locale', 5_000, {
      exercises: [
        {
          id: 'ex-local',
          name: 'Curl',
          sets: [
            { reps: 10, weightKg: 12, done: true, rpe: 8 },
            { reps: 10, weightKg: 12, done: true, rpe: 8 },
          ],
        },
      ],
    })
    const local = seedLive(training, {
      draft: draft({
        sessionId,
        startedAt: 1_000,
        updatedAt: 5_000,
        activeExerciseIndex: 2,
      }),
      liveRoutine: localRoutine,
    })
    const remoteTraining: TrainingState = {
      ...local,
      activeWorkoutDraft: draft({
        sessionId,
        startedAt: 1_000,
        updatedAt: 2_000,
        activeExerciseIndex: 0,
      }),
      routines: local.routines.map((item) =>
        item.id === 'live-free' ? routine('live-free', 'Copie cloud', 2_000) : item,
      ),
    }
    cloud.applyCloudBackupPayload(remotePayload(cloud, remoteTraining))
    const after = training.getTrainingState()
    expect(after.activeWorkoutDraft?.sessionId).toBe(sessionId)
    expect(after.activeWorkoutDraft?.updatedAt).toBe(5_000)
    expect(after.activeWorkoutDraft?.activeExerciseIndex).toBe(2)
  })

  it('sessionId : séance close à distance jamais ressuscitée (horloge locale en avance)', async () => {
    const { training, cloud } = await load()
    const sessionId = '22222222-2222-4222-8222-222222222222'
    seedLive(training, {
      draft: draft({
        sessionId,
        startedAt: 9_000_000,
        updatedAt: 9_500_000,
        activeExerciseIndex: 3,
      }),
      liveRoutine: routine('live-free', 'Locale en avance', 9_500_000),
    })
    const finished = note({
      id: 'note-closed-ahead',
      createdAt: 1_000,
      routineId: 'live-free',
      sessionId,
      title: 'Séance terminée ailleurs',
    })
    const remoteTraining: TrainingState = {
      ...training.getTrainingState(),
      activeWorkoutDraft: null,
      workoutNotes: [finished],
    }
    cloud.applyCloudBackupPayload(remotePayload(cloud, remoteTraining))
    const after = training.getTrainingState()
    expect(after.activeWorkoutDraft).toBeNull()
    expect(after.workoutNotes.some((item) => item.id === 'note-closed-ahead')).toBe(true)
    expect(after.workoutNotes.find((item) => item.id === 'note-closed-ahead')?.sessionId).toBe(
      sessionId,
    )
  })

  it('sessionId : séance close à distance jamais ressuscitée + completion distante conservée (horloge locale en retard)', async () => {
    const { training, cloud } = await load()
    const sessionId = '33333333-3333-4333-8333-333333333333'
    seedLive(training, {
      draft: draft({
        sessionId,
        startedAt: 100,
        updatedAt: 200,
        activeExerciseIndex: 1,
      }),
      liveRoutine: routine('live-free', 'Locale en retard', 200),
    })
    const finished = note({
      id: 'note-closed-behind',
      createdAt: 9_000_000,
      routineId: 'live-free',
      sessionId,
      title: 'Séance cloud plus récente',
    })
    const remoteTraining: TrainingState = {
      ...training.getTrainingState(),
      activeWorkoutDraft: null,
      workoutNotes: [finished],
    }
    cloud.applyCloudBackupPayload(remotePayload(cloud, remoteTraining))
    const after = training.getTrainingState()
    expect(after.activeWorkoutDraft).toBeNull()
    expect(after.workoutNotes.map((item) => item.id)).toContain('note-closed-behind')
    expect(after.workoutNotes.find((item) => item.id === 'note-closed-behind')?.createdAt).toBe(
      9_000_000,
    )
  })

  it('sessionId : autre séance live locale + completion distante conservée (pas de blend)', async () => {
    const { training, cloud } = await load()
    const localId = '44444444-4444-4444-8444-444444444444'
    const remoteFinishedId = '55555555-5555-4555-8555-555555555555'
    const local = seedLive(training, {
      draft: draft({
        sessionId: localId,
        startedAt: 9_000_000,
        updatedAt: 9_500_000,
        activeExerciseIndex: 2,
      }),
      liveRoutine: routine('live-free', 'Encore en cours', 9_500_000),
    })
    const finished = note({
      id: 'note-other-session',
      createdAt: 500,
      routineId: 'other',
      sessionId: remoteFinishedId,
      title: 'Autre séance déjà close',
    })
    const remoteTraining: TrainingState = {
      ...local,
      activeWorkoutDraft: draft({
        sessionId: remoteFinishedId,
        startedAt: 400,
        updatedAt: 500,
        routineId: 'other',
      }),
      workoutNotes: [finished],
    }
    cloud.applyCloudBackupPayload(remotePayload(cloud, remoteTraining))
    const after = training.getTrainingState()
    expect(after.activeWorkoutDraft?.sessionId).toBe(localId)
    expect(after.activeWorkoutDraft?.updatedAt).toBe(9_500_000)
    expect(after.workoutNotes.some((item) => item.id === 'note-other-session')).toBe(true)
  })

  it('legacy sans sessionId : le fallback horodatage refuse encore une séance close (même startedAt)', async () => {
    const { training, cloud } = await load()
    seedLive(training, {
      draft: draft({ startedAt: 1_000, updatedAt: 9_000, activeExerciseIndex: 2 }),
      liveRoutine: routine('live-free', 'Legacy locale', 9_000),
    })
    const finished = note({
      id: 'note-legacy-closed',
      createdAt: 1_000,
      routineId: 'live-free',
      title: 'Legacy close',
    })
    const remoteTraining: TrainingState = {
      ...training.getTrainingState(),
      activeWorkoutDraft: null,
      workoutNotes: [finished],
    }
    cloud.applyCloudBackupPayload(remotePayload(cloud, remoteTraining))
    expect(training.getTrainingState().activeWorkoutDraft).toBeNull()
    expect(
      training.getTrainingState().workoutNotes.some((item) => item.id === 'note-legacy-closed'),
    ).toBe(true)
  })

  it('une écriture pendant un push en cours déclenche un second envoi', async () => {
    const { cloud } = await load()

    let releaseFirst: (value: { error?: string }) => void = () => undefined
    mockPushConvexBackupPayload
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve
          }),
      )
      .mockResolvedValue({})

    const first = cloud.pushCloudBackup('user-live')
    await vi.waitFor(() => {
      expect(mockPushConvexBackupPayload).toHaveBeenCalledTimes(1)
    })

    const overlapping = cloud.pushCloudBackup('user-live')
    const overlappingResult = await Promise.race([
      overlapping.then(() => 'resolved'),
      Promise.resolve('pending'),
    ])
    expect(overlappingResult).toBe('pending')
    expect(mockPushConvexBackupPayload).toHaveBeenCalledTimes(1)

    vi.useFakeTimers()
    releaseFirst({})
    await first
    await vi.advanceTimersByTimeAsync(450)

    expect(mockPushConvexBackupPayload).toHaveBeenCalledTimes(2)
  })
})
