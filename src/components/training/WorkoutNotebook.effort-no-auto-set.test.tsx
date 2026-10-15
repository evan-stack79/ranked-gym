/** @vitest-environment jsdom */
/**
 * DEV-RG-07 : saisir Effort ne doit jamais créer de série.
 * Mécanisme historique : Effort → auto-validate → Reprendre (addNextSet) → append.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RestTimerProvider } from '../../context/RestTimerContext'
import { WorkoutNotebook } from './WorkoutNotebook'
import type { ActiveWorkoutDraft, ExerciseEntry, WorkoutRoutine } from '../../types/training'

const { draftHolder } = vi.hoisted(() => {
  const draftHolder: { current: ActiveWorkoutDraft | null } = { current: null }
  return { draftHolder }
})

vi.mock('../../services/trainingStorage', () => ({
  DEFAULT_ROUTINES: [{ id: 'live' }, { id: 'upper' }],
  resolveResumedRoutineId: ({ launchRoutineId }: { launchRoutineId?: string | null }) =>
    launchRoutineId ?? 'live',
  setLastSelectedRoutine: vi.fn(),
  getTrainingState: () => ({
    activeWorkoutDraft: draftHolder.current,
    favoriteSportIds: ['musculation'],
    preferredRestSec: 90,
  }),
  persistActiveExerciseIndex: (index: number) => {
    if (!draftHolder.current) return
    draftHolder.current = {
      ...draftHolder.current,
      activeExerciseIndex: index,
      updatedAt: Date.now(),
    }
  },
  persistActiveRestTimer: vi.fn(),
  getTrainingStorageScope: () => 'guest',
  setPreferredRestSec: vi.fn(),
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

function liveDraft(index = 0): ActiveWorkoutDraft {
  return {
    routineId: 'live',
    sportId: 'musculation',
    startedAt: 1_000,
    updatedAt: 2_000,
    activeExerciseIndex: index,
    restTimer: null,
  }
}

function makeRoutine(exercises: ExerciseEntry[]): WorkoutRoutine {
  return {
    id: 'live',
    label: 'Musculation',
    subtitle: '',
    accent: '#FF2B2B',
    exercises,
    updatedAt: 2_000,
  }
}

let host: HTMLDivElement
let root: Root
let drafts: ReturnType<typeof vi.fn>
let restLog:
  | {
      exerciseId: string
      setIndex: number
      restSec: number
      addNextSet: boolean
      nonce: number
    }
  | null

function typeInto(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function setCount() {
  return host.querySelectorAll('[data-set-row]').length
}

async function renderNotebook(
  exercises: ExerciseEntry[],
  opts?: { restLogRequest?: typeof restLog },
) {
  restLog = opts?.restLogRequest ?? null
  await act(async () => {
    root.render(
      <RestTimerProvider>
        <WorkoutNotebook
          bodyWeightKg={80}
          routines={[makeRoutine(exercises)]}
          history={[]}
          initialRoutineId="live"
          sportId="musculation"
          onSave={vi.fn()}
          onDraftSave={drafts}
          onDeleteNote={vi.fn()}
          onAddRoutine={vi.fn()}
          sessionClockLabel="00:42"
          sessionPaused={false}
          resume
          restLogRequest={restLog}
        />
      </RestTimerProvider>,
    )
  })
}

async function reRenderWithRestLog(
  exercises: ExerciseEntry[],
  request: NonNullable<typeof restLog>,
) {
  restLog = request
  await act(async () => {
    root.render(
      <RestTimerProvider>
        <WorkoutNotebook
          bodyWeightKg={80}
          routines={[makeRoutine(exercises)]}
          history={[]}
          initialRoutineId="live"
          sportId="musculation"
          onSave={vi.fn()}
          onDraftSave={drafts}
          onDeleteNote={vi.fn()}
          onAddRoutine={vi.fn()}
          sessionClockLabel="00:42"
          sessionPaused={false}
          resume
          restLogRequest={restLog}
        />
      </RestTimerProvider>,
    )
  })
}

async function enterEffort(setIndex = 0, value = '8') {
  const effort = host.querySelector(
    `input[aria-label="Série ${setIndex + 1} effort facultatif"]`,
  ) as HTMLInputElement | null
  expect(effort, `champ Effort série ${setIndex + 1}`).toBeTruthy()
  await act(async () => {
    effort!.focus()
    typeInto(effort!, value)
  })
}

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  drafts = vi.fn()
  restLog = null
  draftHolder.current = liveDraft(0)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('DEV-RG-07 — Effort ne crée aucune série', () => {
  it('séance libre (1 série) : Effort + Reprendre (addNextSet) n’ajoute pas de série', async () => {
    const free: ExerciseEntry[] = [
      {
        id: 'ex-free',
        name: 'Squat',
        canonicalExerciseId: 'back_squat',
        sets: [{ reps: 8, weightKg: 60 }],
      },
    ]
    await renderNotebook(free)
    expect(setCount()).toBe(1)

    await enterEffort(0, '8')
    expect(setCount()).toBe(1)

    // Miroir TrainingView : skip repos → addNextSet:true (ancien bug)
    await reRenderWithRestLog(free, {
      exerciseId: 'ex-free',
      setIndex: 0,
      restSec: 12,
      addNextSet: true,
      nonce: Date.now(),
    })
    expect(setCount()).toBe(1)
    expect(host.textContent).toContain('Effort')
    expect(host.textContent).not.toContain('RPE')
  })

  it('première série d’un exercice programmé (2+ séries) : Effort n’ajoute pas', async () => {
    const programmed: ExerciseEntry[] = [
      {
        id: 'ex-prog',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [
          { reps: 6, weightKg: 80 },
          { reps: 6, weightKg: 80 },
          { reps: 6, weightKg: 80 },
        ],
      },
    ]
    await renderNotebook(programmed)
    expect(setCount()).toBe(3)
    await enterEffort(0, '7')
    expect(setCount()).toBe(3)

    await reRenderWithRestLog(programmed, {
      exerciseId: 'ex-prog',
      setIndex: 0,
      restSec: 20,
      addNextSet: true,
      nonce: Date.now(),
    })
    expect(setCount()).toBe(3)
  })

  it('dernière série d’un exercice programmé : Effort + addNextSet n’ajoute pas', async () => {
    const lastOpen: ExerciseEntry[] = [
      {
        id: 'ex-last',
        name: 'Row barre',
        canonicalExerciseId: 'barbell_row',
        sets: [
          { reps: 8, weightKg: 50, done: true, rpe: 7 },
          { reps: 8, weightKg: 50, done: true, rpe: 8 },
          { reps: 8, weightKg: 50 },
        ],
      },
    ]
    await renderNotebook(lastOpen)
    expect(setCount()).toBe(3)
    await enterEffort(2, '9')
    expect(setCount()).toBe(3)

    await reRenderWithRestLog(lastOpen, {
      exerciseId: 'ex-last',
      setIndex: 2,
      restSec: 30,
      addNextSet: true,
      nonce: Date.now(),
    })
    expect(setCount()).toBe(3)
  })

  it('série déjà validée : pas d’ajout ; affichage Effort n/10 sans RPE', async () => {
    const done: ExerciseEntry[] = [
      {
        id: 'ex-done',
        name: 'Curl',
        canonicalExerciseId: 'barbell_curl',
        sets: [
          { reps: 10, weightKg: 20, done: true, rpe: 6 },
          { reps: 10, weightKg: 20 },
        ],
      },
    ]
    await renderNotebook(done)
    expect(setCount()).toBe(2)
    expect(host.querySelector('input[aria-label="Série 1 effort facultatif"]')).toBeNull()
    expect(host.textContent).toContain('6/10')
    expect(host.textContent).not.toContain('RPE')

    await reRenderWithRestLog(done, {
      exerciseId: 'ex-done',
      setIndex: 0,
      restSec: 45,
      addNextSet: true,
      nonce: Date.now(),
    })
    expect(setCount()).toBe(2)
  })

  it('non-régression : + Ajouter une série crée bien une série manuellement', async () => {
    const one: ExerciseEntry[] = [
      {
        id: 'ex-add',
        name: 'Presse',
        canonicalExerciseId: 'leg_press',
        sets: [{ reps: 10, weightKg: 100 }],
      },
    ]
    await renderNotebook(one)
    expect(setCount()).toBe(1)

    const addBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Ajouter une série'),
    )
    expect(addBtn).toBeTruthy()
    await act(async () => {
      addBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(setCount()).toBe(2)
  })
})
