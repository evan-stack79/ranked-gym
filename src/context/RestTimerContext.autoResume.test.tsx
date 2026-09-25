/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecoveryTimerPanel } from '../components/training/RecoveryTimerPanel'
import {
  RestTimerProvider,
  subscribeRestLogged,
  useRestTimerContext,
} from './RestTimerContext'
import { playRestCompleteChime } from '../utils/restTimerSound'

const persistSpy = vi.fn()
let persistedRest: unknown = null

vi.mock('../services/trainingStorage', () => ({
  getTrainingState: () => ({
    activeWorkoutDraft: persistedRest ? { restTimer: persistedRest } : null,
  }),
  getTrainingStorageScope: () => 'guest',
  persistActiveRestTimer: (snap: unknown) => {
    persistSpy(snap)
    persistedRest = snap
  },
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

function Starter({ seconds = 2 }: { seconds?: number }) {
  const rest = useRestTimerContext()
  return (
    <button
      type="button"
      data-testid="start"
      onClick={() =>
        rest.start(seconds, {
          exerciseId: 'ex-1',
          setIndex: 0,
          exerciseName: 'Squat',
          setLabel: 'S1',
        })
      }
    >
      go
    </button>
  )
}

function ApiProbe({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useRestTimerContext>) => void
}) {
  const rest = useRestTimerContext()
  return (
    <button type="button" data-testid="probe" onClick={() => onReady(rest)}>
      probe
    </button>
  )
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  persistedRest = null
  persistSpy.mockClear()
  vi.mocked(playRestCompleteChime).mockClear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
})

describe('RestTimer auto-fermeture à 0:00', () => {
  it('tick jusqu’à 0 ferme l’overlay, log skipped:false une fois, son, pas de skip', async () => {
    const logs: Array<{ skipped: boolean }> = []
    const unsub = subscribeRestLogged((p) => logs.push({ skipped: p.skipped }))

    await act(async () => {
      root.render(
        <div className="relative min-h-[100dvh]">
          <RestTimerProvider>
            <Starter seconds={2} />
            <RecoveryTimerPanel />
          </RestTimerProvider>
        </div>,
      )
    })
    await act(async () => {
      host.querySelector('[data-testid="start"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })

    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    expect(logs).toEqual([{ skipped: false }])
    expect(playRestCompleteChime).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('Reprendre avant 0:00 : skipped:true, overlay fermé, pas de son complete', async () => {
    const logs: Array<{ skipped: boolean }> = []
    const unsub = subscribeRestLogged((p) => logs.push({ skipped: p.skipped }))

    await act(async () => {
      root.render(
        <div className="relative min-h-[100dvh]">
          <RestTimerProvider>
            <Starter seconds={90} />
            <RecoveryTimerPanel />
          </RestTimerProvider>
        </div>,
      )
    })
    await act(async () => {
      host.querySelector('[data-testid="start"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()

    await act(async () => {
      host
        .querySelector('[data-recovery-resume]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    expect(logs).toEqual([{ skipped: true }])
    expect(playRestCompleteChime).not.toHaveBeenCalled()
    unsub()
  })

  it('hydrate déjà expiré : auto-ferme sans son, un seul log skipped:false', async () => {
    const logs: Array<{ skipped: boolean }> = []
    const unsub = subscribeRestLogged((p) => logs.push({ skipped: p.skipped }))
    persistedRest = {
      totalSec: 90,
      remainingSec: 0,
      endsAt: Date.now() - 5_000,
      paused: false,
      target: {
        exerciseId: 'ex-1',
        setIndex: 0,
        exerciseName: 'Squat',
        setLabel: 'S1',
      },
    }

    await act(async () => {
      root.render(
        <div className="relative min-h-[100dvh]">
          <RestTimerProvider>
            <RecoveryTimerPanel />
          </RestTimerProvider>
        </div>,
      )
    })

    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    expect(logs).toEqual([{ skipped: false }])
    expect(playRestCompleteChime).not.toHaveBeenCalled()

    // Remount / re-hydrate même expireKey → pas de double log
    await act(async () => {
      window.dispatchEvent(new Event('ranked-gym:backup-restored'))
    })
    expect(logs).toHaveLength(1)
    unsub()
  })

  it('auto-fermeture puis skip : pas de second rest-logged', async () => {
    const logs: Array<{ skipped: boolean }> = []
    const unsub = subscribeRestLogged((p) => logs.push({ skipped: p.skipped }))
    const box: { api?: ReturnType<typeof useRestTimerContext> } = {}

    await act(async () => {
      root.render(
        <div className="relative min-h-[100dvh]">
          <RestTimerProvider>
            <Starter seconds={1} />
            <ApiProbe
              onReady={(r) => {
                box.api = r
              }}
            />
            <RecoveryTimerPanel />
          </RestTimerProvider>
        </div>,
      )
    })
    await act(async () => {
      host.querySelector('[data-testid="start"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
      host.querySelector('[data-testid="probe"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(logs).toEqual([{ skipped: false }])
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()

    await act(async () => {
      box.api?.skip()
    })
    expect(logs).toEqual([{ skipped: false }])
    unsub()
  })

  it('+15 s avant 0:00 reste disponible ; état actif', async () => {
    await act(async () => {
      root.render(
        <div className="relative min-h-[100dvh]">
          <RestTimerProvider>
            <Starter seconds={90} />
            <RecoveryTimerPanel />
          </RestTimerProvider>
        </div>,
      )
    })
    await act(async () => {
      host.querySelector('[data-testid="start"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })
    await act(async () => {
      host
        .querySelector('[data-recovery-add-15]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-recovery-remaining]')?.textContent).toBe('01:45')
    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()
  })
})
