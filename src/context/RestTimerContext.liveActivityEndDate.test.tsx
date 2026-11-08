/** @vitest-environment jsdom */
/**
 * Architect (CAUSE_CHRONO_ILE) — rest Live Activity is wall-clock driven:
 * - app frozen in background → no per-second Activity updates
 * - start payload has correct startDateMs / endDateMs (staleDate == endDateMs)
 * - pause → fixed remaining; resume → new start/end window
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

describe('RestTimerContext — Live Activity endDate / ProgressView window (Architect)', () => {
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

  async function mountApi() {
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
    return { api: api!, live }
  }

  it('repos lancé → startDate/endDate corrects ; staleDate == endDate ; figé BG → aucun update /s', async () => {
    const { api, live } = await mountApi()
    const restSec = 60
    const t0 = Date.now()

    await act(async () => {
      api.start(restSec, {
        exerciseId: 'ex-bg',
        setIndex: 0,
        exerciseName: 'Squat',
        setLabel: 'S1',
      })
    })

    expect(laStart).toHaveBeenCalledTimes(1)
    const startPayload = laStart.mock.calls[0]?.[0] as {
      kind?: string
      startDateMs?: number
      endDateMs?: number
      remainingSec?: number
      totalSec?: number
      paused?: boolean
    }
    expect(startPayload.kind).toBe('rest')
    expect(startPayload.remainingSec).toBe(restSec)
    expect(startPayload.totalSec).toBe(restSec)
    expect(startPayload.startDateMs).toBe(t0)
    expect(startPayload.endDateMs).toBe(t0 + restSec * 1000)
    expect(startPayload.paused).toBeFalsy()

    // Native contract: staleDate = endDate when running
    expect(
      live.restLiveActivityStaleDateMs({
        kind: 'rest',
        endDateMs: startPayload.endDateMs,
        paused: false,
      }),
    ).toBe(startPayload.endDateMs)

    const window = live.restLiveActivityWindowMs({
      endDateMs: startPayload.endDateMs!,
      totalSec: restSec,
      startDateMs: startPayload.startDateMs,
    })
    expect(window).toEqual({
      startDateMs: t0,
      endDateMs: t0 + restSec * 1000,
    })

    laStart.mockClear()
    laUpdate.mockClear()

    // Appli figée en arrière-plan : aucun tick JS.
    expect(laUpdate).not.toHaveBeenCalled()
    expect(laStart).not.toHaveBeenCalled()

    // Tick in-app (premier plan) ne doit toujours pas pousser d’update/s vers l’activité.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(laUpdate).not.toHaveBeenCalled()
    expect(laStart).not.toHaveBeenCalled()
  })

  it('pause → remaining fixe + dates à 0 (staleDate null) ; reprise → nouvelle fenêtre start/end', async () => {
    const { api, live } = await mountApi()

    await act(async () => {
      api.start(60, {
        exerciseId: 'ex-p',
        setIndex: 0,
        exerciseName: 'Row',
        setLabel: 'S2',
      })
    })
    laUpdate.mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
      api.pause()
    })

    expect(laUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rest',
        paused: true,
        startDateMs: 0,
        endDateMs: 0,
        remainingSec: expect.any(Number),
      }),
    )
    const pausePayload = laUpdate.mock.calls.at(-1)?.[0] as {
      remainingSec: number
      endDateMs: number
      paused: boolean
    }
    expect(pausePayload.remainingSec).toBeGreaterThan(0)
    expect(pausePayload.remainingSec).toBeLessThanOrEqual(50)
    expect(
      live.restLiveActivityStaleDateMs({
        kind: 'rest',
        endDateMs: pausePayload.endDateMs,
        paused: true,
      }),
    ).toBeNull()

    laUpdate.mockClear()
    const resumeAt = Date.now()
    await act(async () => {
      api.resume()
    })

    expect(laUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rest',
        paused: false,
        remainingSec: pausePayload.remainingSec,
        startDateMs: resumeAt,
        endDateMs: resumeAt + pausePayload.remainingSec * 1000,
      }),
    )
    const resumePayload = laUpdate.mock.calls.at(-1)?.[0] as {
      startDateMs: number
      endDateMs: number
      paused: boolean
    }
    expect(
      live.restLiveActivityStaleDateMs({
        kind: 'rest',
        endDateMs: resumePayload.endDateMs,
        paused: false,
      }),
    ).toBe(resumePayload.endDateMs)
  })
})
