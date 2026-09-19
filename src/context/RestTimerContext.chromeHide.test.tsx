// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RestTimerProvider, useRestTimerContext } from '../context/RestTimerContext'

const persistActiveRestTimer = vi.fn()

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
  persistActiveRestTimer: (...args: unknown[]) => persistActiveRestTimer(...args),
}))

vi.mock('../services/restTimerLiveActivity', () => ({
  startRestLiveActivity: vi.fn(),
  updateRestLiveActivity: vi.fn(),
  endRestLiveActivity: vi.fn(),
}))

vi.mock('../utils/restTimerSound', () => ({
  playRestCompleteChime: vi.fn(),
}))

vi.mock('../utils/haptics', () => ({
  vibrate: vi.fn(),
}))

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useRestTimerContext>) => void }) {
  const api = useRestTimerContext()
  onReady(api)
  return null
}

describe('RestTimerContext — chrome hide ne wipe pas le repos', () => {
  let host: HTMLDivElement
  let root: Root
  let api: ReturnType<typeof useRestTimerContext> | null = null

  beforeEach(() => {
    persistActiveRestTimer.mockClear()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
    api = null
  })

  it('setChromeHidden(true) conserve le timer actif (leave→Reprendre)', async () => {
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <Probe onReady={(a) => { api = a }} />
        </RestTimerProvider>,
      )
    })
    expect(api).not.toBeNull()
    await act(async () => {
      api!.start(90, {
        exerciseId: 'ex-1',
        setIndex: 0,
        exerciseName: 'Curl',
        setLabel: 'S1',
      })
    })
    expect(api!.state.active).toBe(true)
    const remainingBefore = api!.state.remainingSec

    await act(async () => {
      api!.setChromeHidden(true)
    })
    expect(api!.chromeHidden).toBe(true)
    expect(api!.state.active).toBe(true)
    expect(api!.state.remainingSec).toBe(remainingBefore)

    await act(async () => {
      api!.setChromeHidden(false)
    })
    expect(api!.state.active).toBe(true)
  })
})
