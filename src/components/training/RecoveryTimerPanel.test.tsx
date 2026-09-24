/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatRecoveryClock,
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

describe('formatRecoveryClock', () => {
  it('format MM:SS obligatoire (01:30, 00:47, 00:30, 00:05)', () => {
    expect(formatRecoveryClock(90)).toBe('01:30')
    expect(formatRecoveryClock(47)).toBe('00:47')
    expect(formatRecoveryClock(30)).toBe('00:30')
    expect(formatRecoveryClock(5)).toBe('00:05')
    expect(formatRecoveryClock(0)).toBe('00:00')
  })
})

describe('formatRecoveryDurationLabel', () => {
  it('formate 90 s → 1 min 30', () => {
    expect(formatRecoveryDurationLabel(90)).toBe('1 min 30')
    expect(formatRecoveryDurationLabel(45)).toBe('45 s')
    expect(formatRecoveryDurationLabel(60)).toBe('1 min')
  })
})

describe('RecoveryTimerPanel', () => {
  it('repos 90 s démarre à 01:30 ; label Récupération · 1 min 30 ; pas de bandeau série', async () => {
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
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    await act(async () => {
      host.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const panel = host.querySelector('[data-recovery-timer]')
    expect(panel).toBeTruthy()
    expect(host.querySelector('[data-recovery-veil]')).toBeTruthy()
    expect(host.querySelector('[data-recovery-glow]')).toBeTruthy()
    expect(host.querySelector('[data-recovery-plate]')).toBeTruthy()
    expect(host.querySelector('[data-recovery-label]')?.textContent).toBe(
      'Récupération · 1 min 30',
    )
    expect(host.querySelector('[data-recovery-remaining]')?.textContent).toBe('01:30')
    expect(host.querySelector('[data-recovery-resume]')?.textContent).toContain('Reprendre')
    expect(host.querySelector('[data-recovery-add-15]')?.textContent).toContain('+15 s')
    // Plus de bandeau « Série N terminée »
    expect(host.querySelector('[data-recovery-completed-summary]')).toBeNull()
    expect(host.textContent).not.toMatch(/Série \d+ terminée/)
    expect(host.textContent).not.toContain('+30 s')
    expect(host.textContent).not.toContain('Passer')
    expect(host.textContent).not.toContain('RPE')
  })

  it('+15 s prolonge endsAt ; label reste 1 min 30 ; Reprendre arrête', async () => {
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
            <RecoveryTimerPanel />
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
    expect(host.querySelector('[data-recovery-remaining]')?.textContent).toBe('01:30')

    const beforeCalls = persist.mock.calls.length
    await act(async () => {
      host
        .querySelector('[data-recovery-add-15]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(persist.mock.calls.length).toBeGreaterThan(beforeCalls)
    const last = persist.mock.calls.at(-1)?.[0] as { endsAt: number; remainingSec: number }
    expect(last.remainingSec).toBeGreaterThanOrEqual(100)
    // Label programmé figé
    expect(host.querySelector('[data-recovery-label]')?.textContent).toBe(
      'Récupération · 1 min 30',
    )

    await act(async () => {
      host
        .querySelector('[data-recovery-resume]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
  })
})
