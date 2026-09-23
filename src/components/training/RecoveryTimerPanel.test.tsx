/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatRecoveryDurationLabel,
  RecoveryTimerPanel,
} from './RecoveryTimerPanel'
import { RestTimerProvider, useRestTimerContext } from '../../context/RestTimerContext'

vi.mock('../../services/trainingStorage', () => ({
  getTrainingState: () => ({ activeWorkoutDraft: null }),
  getTrainingStorageScope: () => 'guest',
  persistActiveRestTimer: vi.fn(),
}))

vi.mock('../../services/restTimerLiveActivity', () => ({
  startRestLiveActivity: vi.fn(),
  updateRestLiveActivity: vi.fn(),
  endRestLiveActivity: vi.fn(),
}))

vi.mock('../../utils/restTimerSound', () => ({
  playRestCompleteChime: vi.fn(),
}))

vi.mock('../../utils/haptics', () => ({
  vibrate: vi.fn(),
}))

function Starter({ seconds = 90 }: { seconds?: number }) {
  const rest = useRestTimerContext()
  return (
    <button
      type="button"
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
    <button type="button" onClick={() => onReady(rest)}>
      probe
    </button>
  )
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('formatRecoveryDurationLabel', () => {
  it('formate 90 s → 1 min 30', () => {
    expect(formatRecoveryDurationLabel(90)).toBe('1 min 30')
    expect(formatRecoveryDurationLabel(45)).toBe('45 s')
    expect(formatRecoveryDurationLabel(60)).toBe('1 min')
  })
})

describe('RecoveryTimerPanel', () => {
  it('maquette : Récupération rouge, chrono, Reprendre ghost, +15 s, pas de barre/carte', async () => {
    await act(async () => {
      root.render(
        <div className="relative min-h-[100dvh]">
          <RestTimerProvider>
            <Starter />
            <RecoveryTimerPanel
              completedSummary={{ setNumber: 1, weightKg: 80, reps: 6 }}
            />
          </RestTimerProvider>
        </div>,
      )
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    await act(async () => {
      host.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const panel = host.querySelector('[data-recovery-timer]')
    expect(panel).toBeTruthy()
    expect(host.querySelector('[data-recovery-overlay]')).toBeTruthy()
    expect(host.querySelector('[data-recovery-label]')?.textContent).toContain('Récupération')
    expect(host.querySelector('[data-recovery-label]')?.textContent).toContain('1 min 30')
    expect(host.querySelector('[data-recovery-remaining]')?.textContent).toMatch(/01:3/)
    expect(host.querySelector('[data-recovery-resume]')?.textContent).toContain('Reprendre')
    expect(host.querySelector('[data-recovery-add-15]')?.textContent).toContain('+15 s')
    expect(host.querySelector('[data-recovery-completed-summary]')?.textContent).toContain(
      'Série 1 terminée · 80 kg × 6',
    )
    // Pas de vestiges ancienne UI
    expect(host.textContent).not.toContain('+30 s')
    expect(host.textContent).not.toContain('Passer')
    expect(host.textContent).not.toContain('Série suivante')
    expect(host.textContent).not.toContain('RPE')
    expect(panel!.querySelector('[aria-hidden="true"] .h-1\\.5')).toBeNull()
    expect(panel!.className).not.toMatch(/rounded-2xl/)
    expect(panel!.className).not.toMatch(/border-white/)
  })

  it('+15 s prolonge endsAt ; Reprendre (skip) arrête le timer', async () => {
    const box: { api?: ReturnType<typeof useRestTimerContext> } = {}
    const { persistActiveRestTimer } = await import('../../services/trainingStorage')
    const persist = vi.mocked(persistActiveRestTimer)
    persist.mockClear()

    await act(async () => {
      root.render(
        <div className="relative min-h-[100dvh]">
          <RestTimerProvider>
            <Starter seconds={90} />
            <ApiProbe
              onReady={(r) => {
                box.api = r
              }}
            />
            <RecoveryTimerPanel
              completedSummary={{ setNumber: 1, weightKg: 80, reps: 6 }}
            />
          </RestTimerProvider>
        </div>,
      )
    })
    await act(async () => {
      ;[...host.querySelectorAll('button')]
        .find((b) => b.textContent === 'go')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      ;[...host.querySelectorAll('button')]
        .find((b) => b.textContent === 'probe')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(box.api?.state.active).toBe(true)

    const beforeCalls = persist.mock.calls.length
    await act(async () => {
      host
        .querySelector('[data-recovery-add-15]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(persist.mock.calls.length).toBeGreaterThan(beforeCalls)
    const last = persist.mock.calls.at(-1)?.[0] as { endsAt: number; remainingSec: number }
    expect(last.remainingSec).toBeGreaterThanOrEqual(100)

    await act(async () => {
      host
        .querySelector('[data-recovery-resume]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
  })
})
