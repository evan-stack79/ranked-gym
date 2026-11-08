/** @vitest-environment jsdom */
/**
 * Vrai chemin RestTimerContext → LiveActivity start payload :
 * après validation série 1/4, setTotal:4 et « Série 2 sur 4 ensuite ».
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { restNextSeriesLabel } from '../services/liveActivityDisplay'

const laStart = vi.fn(async (_opts?: Record<string, unknown>) => ({
  activityId: 'a1',
  reused: false,
}))
const laUpdate = vi.fn(async () => ({ updated: true }))
const laEnd = vi.fn(async () => {})

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
        addListener: async () => ({ remove: () => {} }),
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

describe('RestTimerContext → LiveActivity setTotal (vrai chemin)', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T00:00:00.000Z'))
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

  it('après série 1/4 → payload setTotal:4 et « Série 2 sur 4 ensuite »', async () => {
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

    // Validated series 1 → 0-based setIndex 0, exercise has 4 sets
    await act(async () => {
      api!.start(90, {
        exerciseId: 'ex-1',
        setIndex: 0,
        exerciseName: 'Squat',
        setLabel: 'S1',
        setTotal: 4,
      })
    })

    expect(laStart).toHaveBeenCalled()
    const payload = laStart.mock.calls[0]?.[0] as {
      kind?: string
      setIndex?: number
      setTotal?: number
    }
    expect(payload.kind).toBe('rest')
    expect(payload.setTotal).toBe(4)
    expect(payload.setIndex).toBe(2) // next series (1-based)
    expect(restNextSeriesLabel(payload.setIndex!, payload.setTotal)).toBe(
      'Série 2 sur 4 ensuite',
    )
  })

  it('ne invente pas setTotal=1 quand le total est absent', async () => {
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
        exerciseId: 'ex-unknown',
        setIndex: 0,
        exerciseName: 'Row',
        setLabel: 'S1',
        // no setTotal
      })
    })

    const payload = laStart.mock.calls[0]?.[0] as { setTotal?: number; setIndex?: number }
    expect(payload.setTotal).toBe(0)
    expect(restNextSeriesLabel(payload.setIndex ?? 2, payload.setTotal)).toBeNull()
  })
})
