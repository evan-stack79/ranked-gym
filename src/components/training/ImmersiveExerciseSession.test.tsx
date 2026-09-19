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

/** Evan runtime-shaped séance — titre libre, pas d’ID canonique, 20 kg × 8. */
const realSessionExercises: ExerciseEntry[] = [
  {
    id: 'ex-live-1',
    name: 'DÉVELOPPER',
    sets: [{ reps: 8, weightKg: 20 }],
  },
]

/** Canonical path — photo local when metadata is present. */
const benchCanonicalExercises: ExerciseEntry[] = [
  {
    id: 'ex-bench',
    name: 'DÉVELOPPER',
    canonicalExerciseId: 'bench_press',
    sets: [
      { reps: 6, weightKg: 80, done: true, rpe: 8 },
      { reps: 6, weightKg: 80 },
    ],
  },
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
  it('affiche les données réelles DÉVELOPPER 1/1 20×8 sans inventer de photo', async () => {
    const onValidate = vi.fn()
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={realSessionExercises}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="00:42"
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
    expect(host.querySelector('[data-exercise-slug="developper"]')).toBeTruthy()
    expect(host.querySelector('[data-hero-image="fallback"]')).toBeTruthy()
    expect(host.querySelector('[data-hero-fallback]')).toBeTruthy()
    expect(host.querySelector('[data-hero-photo]')).toBeNull()
    expect(host.textContent).toContain('DÉVELOPPER')
    expect(host.textContent).toContain('Exercice 1 sur 1')
    expect(host.textContent).not.toContain('Pectoraux')
    expect(host.textContent).not.toContain('Développé couché')
    const weightInput = host.querySelector(
      'input[aria-label="Série 1 poids"]',
    ) as HTMLInputElement | null
    const repsInput = host.querySelector(
      'input[aria-label="Série 1 reps"]',
    ) as HTMLInputElement | null
    expect(weightInput?.value).toBe('20')
    expect(repsInput?.value).toBe('8')
    expect(host.textContent).toContain('1/1')
  })

  it('montre la photo locale quand canonicalExerciseId=bench_press (sans renommer le titre)', async () => {
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={benchCanonicalExercises}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="13:27"
            sessionPaused={false}
            onToggleSessionPause={vi.fn()}
            onBack={vi.fn()}
            onUpdateSet={vi.fn()}
            onAddSet={vi.fn()}
            onValidateSet={vi.fn()}
            onFinishSession={vi.fn()}
          />
        </RestTimerProvider>,
      )
    })

    expect(host.querySelector('[data-canonical-exercise="bench_press"]')).toBeTruthy()
    expect(host.querySelector('[data-hero-image="ready"]')).toBeTruthy()
    const photo = host.querySelector('[data-hero-photo]') as HTMLImageElement | null
    expect(photo).toBeTruthy()
    expect(photo!.getAttribute('src')).toBeTruthy()
    expect(photo!.getAttribute('alt')).toMatch(/développé couché/i)
    // Titre reste celui de la séance — pas de rename arbitraire
    expect(host.textContent).toContain('DÉVELOPPER')
    expect(host.textContent).toContain('Pectoraux · Triceps · Épaules · Barre')
  })

  it('saisie effort 1–10 valide auto la série (anti double-tap)', async () => {
    const onValidate = vi.fn()
    const onUpdate = vi.fn()
    const exercises: ExerciseEntry[] = [
      {
        id: 'ex-1',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [
          { reps: 8, weightKg: 60 },
          { reps: 8, weightKg: 60 },
        ],
      },
    ]
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <ImmersiveExerciseSession
            exercises={exercises}
            activeIndex={0}
            onActiveIndexChange={vi.fn()}
            sessionClockLabel="01:00"
            sessionPaused={false}
            onBack={vi.fn()}
            onUpdateSet={onUpdate}
            onAddSet={vi.fn()}
            onValidateSet={onValidate}
            onFinishSession={vi.fn()}
          />
        </RestTimerProvider>,
      )
    })

    const effort = host.querySelector(
      'input[aria-label="Série 1 effort (valide la série)"]',
    ) as HTMLInputElement | null
    expect(effort).toBeTruthy()
    await act(async () => {
      effort!.focus()
      effort!.value = '7'
      effort!.dispatchEvent(new Event('input', { bubbles: true }))
      effort!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    // ClearableNumberInput calls onChange on input with parsed number
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set
      nativeInputValueSetter?.call(effort, '7')
      effort!.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(onValidate).toHaveBeenCalled()
    expect(onValidate.mock.calls[0][1]).toBe(0)
    expect(onValidate.mock.calls[0][3]).toMatchObject({ rpe: 7 })
    // Pas d’update séparé avant validate (évite course state)
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
