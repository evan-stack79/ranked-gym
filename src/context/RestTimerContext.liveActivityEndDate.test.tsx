/** @vitest-environment jsdom */
/**
 * DI freeze fix: rest Live Activity is endDate-driven.
 * Simulates app frozen in background (no JS ticks) and asserts:
 * - start payload includes a correct wall-clock endDateMs
 * - no per-second Live Activity updates while the in-app tick runs / is frozen
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
        schedule: vi.fn(async () => ({ scheduled: true })),
        cancel: vi.fn(async () => {}),
        releaseAudioSession: vi.fn(async () => {}),
        preview: vi.fn(async () => {}),
        playNow: vi.fn(async () => ({ played: true })),
        vibrate: vi.fn(async () => {}),
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

describe('RestTimerContext — Live Activity endDate (background)', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T22:00:00.000Z'))
    laStart.mockClear()
    laUpdate.mockClear()
    laEnd.mockClear()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    vi.useRealTimers()
    await act(async () => root.unmount())
    host.remove()
  })

  it('repos lancé → endDateMs correct ; figé sans tick JS → aucun update /s', async () => {
    const { RestTimerProvider, useRestTimerContext } = await import('./RestTimerContext')
    const live = await import('../services/liveActivity')
    const sound = await import('../utils/restTimerSound')

    live.__resetLiveActivityBridgeForTests()
    sound.__resetRestTimerSoundTestHooks()

    let api: ReturnType<typeof useRestTimerContext> | null = null
    function Probe() {
      api = useRestTimerContext()
      return null
    }

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <Probe />
        </RestTimerProvider>,
      )
    })
    expect(api).not.toBeNull()

    const restSec = 60
    const t0 = Date.now()
    await act(async () => {
      api!.start(restSec, {
        exerciseId: 'ex-bg',
        setIndex: 0,
        exerciseName: 'Squat',
        setLabel: 'S1',
      })
    })

    expect(laStart).toHaveBeenCalledTimes(1)
    const startPayload = laStart.mock.calls[0]?.[0] as {
      kind?: string
      endDateMs?: number
      remainingSec?: number
      paused?: boolean
    }
    expect(startPayload.kind).toBe('rest')
    expect(startPayload.remainingSec).toBe(restSec)
    expect(startPayload.endDateMs).toBe(t0 + restSec * 1000)
    expect(startPayload.paused).toBeFalsy()

    laStart.mockClear()
    laUpdate.mockClear()

    // Appli figée en arrière-plan : aucun tick JS (on n’avance pas les timers).
    // L’île doit déjà avoir son endDate — pas besoin d’updates.
    expect(laUpdate).not.toHaveBeenCalled()
    expect(laStart).not.toHaveBeenCalled()

    // Même si le tick in-app reprend (premier plan), plus aucun update/s vers l’activité.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(laUpdate).not.toHaveBeenCalled()
    expect(laStart).not.toHaveBeenCalled()
  })

  it('pause → remaining fixe + endDateMs 0 ; reprise → nouvelle endDateMs', async () => {
    const { RestTimerProvider, useRestTimerContext } = await import('./RestTimerContext')
    const live = await import('../services/liveActivity')
    const sound = await import('../utils/restTimerSound')

    live.__resetLiveActivityBridgeForTests()
    sound.__resetRestTimerSoundTestHooks()

    let api: ReturnType<typeof useRestTimerContext> | null = null
    function Probe() {
      api = useRestTimerContext()
      return null
    }

    await act(async () => {
      root.render(
        <RestTimerProvider>
          <Probe />
        </RestTimerProvider>,
      )
    })

    await act(async () => {
      api!.start(60, {
        exerciseId: 'ex-p',
        setIndex: 0,
        exerciseName: 'Row',
        setLabel: 'S2',
      })
    })
    laUpdate.mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
      api!.pause()
    })

    expect(laUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rest',
        paused: true,
        endDateMs: 0,
        remainingSec: expect.any(Number),
      }),
    )
    const pausedRemaining = (laUpdate.mock.calls.at(-1)?.[0] as { remainingSec: number })
      .remainingSec
    expect(pausedRemaining).toBeGreaterThan(0)
    expect(pausedRemaining).toBeLessThanOrEqual(50)

    laUpdate.mockClear()
    const resumeAt = Date.now()
    await act(async () => {
      api!.resume()
    })

    expect(laUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rest',
        paused: false,
        remainingSec: pausedRemaining,
        endDateMs: resumeAt + pausedRemaining * 1000,
      }),
    )
  })
})
