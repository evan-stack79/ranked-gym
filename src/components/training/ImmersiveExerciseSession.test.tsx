// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImmersiveExerciseSession } from './ImmersiveExerciseSession'
import type { ExerciseEntry } from '../../types/training'
import { RestTimerProvider } from '../../context/RestTimerContext'

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

const exercises: ExerciseEntry[] = [
  { id: 'ex-a', name: 'Échauffement épaules', sets: [{ reps: 15, weightKg: 5, done: true }] },
  { id: 'ex-b', name: 'Pompes', sets: [{ reps: 12, weightKg: 0, done: true }] },
  {
    id: 'ex-1',
    name: 'Développé couché',
    sets: [
      { reps: 6, weightKg: 80, done: true, rpe: 8 },
      { reps: 6, weightKg: 80 },
      { reps: 8, weightKg: 100 },
      { reps: 8, weightKg: 102.5 },
    ],
  },
  { id: 'ex-2', name: 'Développé militaire', sets: [{ reps: 10, weightKg: 40 }] },
  { id: 'ex-3', name: 'Écarté haltères', sets: [{ reps: 12, weightKg: 16 }] },
  { id: 'ex-4', name: 'Dips', sets: [{ reps: 10, weightKg: 0 }] },
  { id: 'ex-5', name: 'Triceps poulie', sets: [{ reps: 12, weightKg: 25 }] },
  { id: 'ex-6', name: 'Face pull', sets: [{ reps: 15, weightKg: 15 }] },
]

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

describe('ImmersiveExerciseSession', () => {
  it('rend le layout immersif développé couché (titre, muscles, progression, actions)', async () => {
    const onValidate = vi.fn()
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={exercises}
            activeIndex={2}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="13:27"
            sessionPaused={false}
            onToggleSessionPause={vi.fn()}
            onBack={vi.fn()}
            onUpdateSet={vi.fn()}
            onAddSet={vi.fn()}
            onValidateSet={onValidate}
            onFinishSession={vi.fn()}
          />
        </RestTimerProvider>,
      )
    })

    expect(host.querySelector('[data-immersive-session]')).toBeTruthy()
    expect(host.querySelector('[data-exercise-slug="developpe-couche"]')).toBeTruthy()
    expect(host.textContent).toContain('Développé couché')
    expect(host.textContent).toContain('Pectoraux · Triceps')
    expect(host.textContent).toContain('Exercice 3 sur 8')
    expect(host.textContent).toContain('Valider la série')
    expect(host.textContent).toContain('+ Ajouter une série')
    expect(host.textContent).toContain('Terminer la séance')
    expect(host.textContent).toContain('13:27')
    expect(host.querySelector('[data-set-row="done"]')).toBeTruthy()
    expect(host.querySelector('[data-set-row="active"]')).toBeTruthy()

    const validateBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Valider la série'),
    )
    expect(validateBtn).toBeTruthy()
    await act(async () => validateBtn!.click())
    expect(onValidate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ex-1' }),
      1,
      90,
    )
  })
})
