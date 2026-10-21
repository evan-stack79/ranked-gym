/** @vitest-environment jsdom */
/**
 * Intégration ESSAI #119+#120+#121 :
 * le chrono de repos pilote à la fois Live Activity (kind rest) et le son (bips 3-2-1).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const laStart = vi.fn(async (_opts?: Record<string, unknown>) => ({
  activityId: 'a1',
  reused: false,
}))
const laUpdate = vi.fn(async (_opts?: Record<string, unknown>) => ({ updated: true }))
const laEnd = vi.fn(async (_opts?: Record<string, unknown>) => {})
const soundSchedule = vi.fn(
  async (_opts: {
    endAtMs: number
    soundEnabled: boolean
    haptics: boolean
    token: string
  }) => ({ scheduled: true as boolean }),
)
const soundCancel = vi.fn(async (_opts?: { releaseSession?: boolean; cancelPending?: boolean }) => {})
const soundVibrate = vi.fn(async () => {})
const soundPlayNow = vi.fn(
  async (
    _token?: string,
    _opts?: {
      cancelPending?: boolean
      volume?: number
      maxDurationSec?: number
      holdSession?: boolean
    },
  ) => ({ played: true }),
)

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
  },
  registerPlugin: (name: string) => {
    if (name === 'LiveActivity') {
      return {
        start: laStart,
        update: laUpdate,
        end: laEnd,
        isAvailable: async () => ({ available: true }),
        alert: vi.fn(async () => ({ alerted: true })),
      }
    }
    if (name === 'RestTimerSound') {
      return {
        schedule: soundSchedule,
        cancel: soundCancel,
        releaseAudioSession: vi.fn(async () => {}),
        preview: vi.fn(async () => {}),
        playNow: soundPlayNow,
        vibrate: soundVibrate,
      }
    }
    return {}
  },
}))

vi.mock('../services/trainingStorage', () => ({
  getTrainingState: () => ({
    activeWorkoutDraft: {
      routineId: 'r1',
      sportId: 'musculation',
      startedAt: 1,
      updatedAt: 1,
      restTimer: null,
    },
  }),
  getTrainingStorageScope: () => 'guest',
  persistActiveRestTimer: vi.fn(),
}))

vi.mock('../utils/haptics', () => ({
  vibrate: vi.fn(),
}))

describe('RestTimerContext — son + Dynamic Island (intégration)', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    laStart.mockClear()
    laUpdate.mockClear()
    laEnd.mockClear()
    soundSchedule.mockClear()
    soundCancel.mockClear()
    soundVibrate.mockClear()
    soundPlayNow.mockClear()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    vi.useRealTimers()
    await act(async () => root.unmount())
    host.remove()
  })

  it('repos lancé → activité rest démarrée ET bips 3-2-1 programmés ; fin → une vibration, activité revient en séance', async () => {
    const { RestTimerProvider, useRestTimerContext } = await import('./RestTimerContext')
    const live = await import('../services/liveActivity')
    const sound = await import('../utils/restTimerSound')

    live.__resetLiveActivityBridgeForTests()
    sound.__resetRestTimerSoundTestHooks()
    sound.setRestTimerCountdownBeeps(true)
    sound.setRestTimerSoundEnabled(true)
    sound.setRestTimerHaptics(true)

    expect(sound.getRestTimerSoundPrefs().countdownBeeps).toBe(true)

    let api: ReturnType<typeof useRestTimerContext> | null = null
    function Probe() {
      api = useRestTimerContext()
      return null
    }

    await live.startSessionLiveActivity({
      exerciseName: 'Squat',
      setIndex: 1,
      setTotal: 3,
      weightKg: 100,
      reps: 5,
      startedAtMs: 1_700_000_000_000,
    })
    expect(laStart).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'session', exerciseName: 'Squat' }),
    )
    laStart.mockClear()
    soundSchedule.mockClear()

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <Probe />
        </RestTimerProvider>,
      )
    })
    expect(api).not.toBeNull()

    const restSec = 5
    await act(async () => {
      api!.start(restSec, {
        exerciseId: 'ex-1',
        setIndex: 0,
        exerciseName: 'Squat',
        setLabel: 'S1',
      })
    })

    // Activité rest démarrée (même activité séance, reuse) avec endDate fixe
    expect(laStart).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rest',
        remainingSec: restSec,
        totalSec: restSec,
        endDateMs: expect.any(Number),
        reuseIfPresent: true,
      }),
    )
    const startedEnd = (laStart.mock.calls[0]?.[0] as { endDateMs?: number } | undefined)?.endDateMs
    expect(startedEnd).toBeGreaterThan(Date.now())
    // Notif / chime de fin + armement (countdownBeeps ON par défaut produit)
    expect(soundSchedule).toHaveBeenCalled()
    expect(soundSchedule.mock.calls[0]?.[0]).toMatchObject({ soundEnabled: true })

    // Bips 3-2-1 programmés / jouables via le même prefs + maybePlayCountdownBeep
    const beepSpy = vi.spyOn(sound, 'maybePlayCountdownBeep')
    await act(async () => {
      await sound.maybePlayCountdownBeep(3)
      await sound.maybePlayCountdownBeep(2)
      await sound.maybePlayCountdownBeep(1)
    })
    expect(beepSpy).toHaveBeenCalledWith(3)
    expect(beepSpy).toHaveBeenCalledWith(2)
    expect(beepSpy).toHaveBeenCalledWith(1)
    expect(soundPlayNow.mock.calls.length).toBeGreaterThanOrEqual(3)

    laStart.mockClear()
    soundVibrate.mockClear()

    // Fin naturelle du chrono → complete() : son + retour séance
    await act(async () => {
      await vi.advanceTimersByTimeAsync(restSec * 1000 + 800)
    })

    expect(soundVibrate).toHaveBeenCalledTimes(1)
    expect(laStart).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'session',
        reuseIfPresent: true,
        exerciseName: 'Squat',
      }),
    )
    expect(laEnd).not.toHaveBeenCalled()
  })
})
