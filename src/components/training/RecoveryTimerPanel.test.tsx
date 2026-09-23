/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecoveryTimerPanel } from './RecoveryTimerPanel'
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

function Starter() {
  const rest = useRestTimerContext()
  return (
    <button
      type="button"
      onClick={() =>
        rest.start(90, {
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

describe('RecoveryTimerPanel', () => {
  it('affiche Récupération, +30 s, Passer et la série suivante', async () => {
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <Starter />
          <RecoveryTimerPanel
            nextHint={{ exerciseName: 'Squat', setLabel: 'Série 2' }}
          />
        </RestTimerProvider>,
      )
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    await act(async () => {
      host.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()
    expect(host.textContent).toContain('Récupération')
    expect(host.textContent).toContain('+30 s')
    expect(host.textContent).toContain('Passer')
    expect(host.textContent).toContain('Série suivante : Série 2 · Squat')
    expect(host.querySelector('[data-recovery-remaining]')?.textContent).toMatch(/01:3/)
  })
})
