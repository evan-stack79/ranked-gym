/** @vitest-environment jsdom */
/**
 * DEV-RG-07 / DEV-RG-08 : saisir Effort ne doit jamais créer de série.
 *
 * Mécanisme historique (pré-#73) : Effort → auto-validate → Reprendre
 * (`restLogRequest.addNextSet` + `shouldAppendNextSetOnRestSkip`) → append.
 * Correctif #73 : `restLogRequest` journalise le repos uniquement ; seul
 * « + Ajouter une série » crée une série.
 *
 * Si le symptôme persiste en prod après #73 sur un iPhone PWA : cause probable
 * = service worker / precache Workbox encore sur le bundle pré-#73
 * (`registerType: 'autoUpdate'` dans vite.config.ts — iOS standalone peut
 * rester sur l’ancienne version jusqu’à fermeture complète de la PWA).
 */
import { act, useEffect, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RestTimerProvider,
  subscribeRestLogged,
  useRestTimerContext,
} from '../../context/RestTimerContext'
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

type RestLogRequest = {
  exerciseId: string
  setIndex: number
  restSec: number
  addNextSet: boolean
  nonce: number
}

let host: HTMLDivElement
let root: Root
let drafts: ReturnType<typeof vi.fn>
let restLog: RestLogRequest | null
/** Dernier brouillon persisté — reprise après unmount / arrière-plan. */
let lastDraftExercises: ExerciseEntry[]

function typeInto(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function setCount() {
  return host.querySelectorAll('[data-set-row]').length
}

function notebookProps(
  exercises: ExerciseEntry[],
  restLogRequest: RestLogRequest | null,
  extras: Partial<{
    onRestStart: NonNullable<React.ComponentProps<typeof WorkoutNotebook>['onRestStart']>
    onRestDismiss: NonNullable<React.ComponentProps<typeof WorkoutNotebook>['onRestDismiss']>
  }> = {},
) {
  return {
    bodyWeightKg: 80,
    routines: [makeRoutine(exercises)],
    history: [] as [],
    initialRoutineId: 'live',
    sportId: 'musculation' as const,
    onSave: vi.fn(),
    onDraftSave: (routineId: string, next: ExerciseEntry[]) => {
      lastDraftExercises = next.map((e) => ({
        ...e,
        sets: e.sets.map((s) => ({ ...s })),
      }))
      drafts(routineId, next)
    },
    onDeleteNote: vi.fn(),
    onAddRoutine: vi.fn(),
    sessionClockLabel: '00:42',
    sessionPaused: false,
    resume: true,
    restLogRequest,
    ...extras,
  }
}

async function renderNotebook(
  exercises: ExerciseEntry[],
  opts?: { restLogRequest?: typeof restLog },
) {
  restLog = opts?.restLogRequest ?? null
  lastDraftExercises = exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => ({ ...s })),
  }))
  await act(async () => {
    root.render(
      <RestTimerProvider>
        <WorkoutNotebook {...notebookProps(exercises, restLog)} />
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
        <WorkoutNotebook {...notebookProps(exercises, restLog)} />
      </RestTimerProvider>,
    )
  })
}

/**
 * Miroir TrainingView : onRestStart → RestTimerContext.start ;
 * ranked-gym:rest-logged → restLogRequest (addNextSet = skipped).
 */
function LiveTrainHarness({
  initialExercises,
}: {
  initialExercises: ExerciseEntry[]
}): ReactElement {
  const rest = useRestTimerContext()
  const [restLogRequest, setRestLogRequest] = useState<RestLogRequest | null>(null)
  const [bootExercises] = useState(initialExercises)

  useEffect(() => {
    return subscribeRestLogged(({ target, restSec, skipped }) => {
      setRestLogRequest({
        exerciseId: target.exerciseId,
        setIndex: target.setIndex,
        restSec,
        addNextSet: skipped,
        nonce: Date.now(),
      })
    })
  }, [])

  return (
    <WorkoutNotebook
      {...notebookProps(bootExercises, restLogRequest, {
        onRestStart: (info) => {
          rest.start(info.restSec ?? 90, {
            exerciseId: info.exerciseId,
            setIndex: info.setIndex,
            exerciseName: info.exerciseName,
            setLabel: info.setLabel,
          })
        },
        onRestDismiss: () => rest.dismiss(),
      })}
    />
  )
}

async function renderLive(exercises: ExerciseEntry[]) {
  lastDraftExercises = exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => ({ ...s })),
  }))
  await act(async () => {
    root.render(
      <RestTimerProvider>
        <LiveTrainHarness initialExercises={exercises} />
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

async function clickReprendre() {
  const btn = host.querySelector('[data-recovery-resume]') as HTMLButtonElement | null
  expect(btn, 'bouton Reprendre (overlay récup)').toBeTruthy()
  await act(async () => {
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  drafts = vi.fn()
  restLog = null
  lastDraftExercises = []
  draftHolder.current = liveDraft(0)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
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

describe('DEV-RG-08 — Reprendre / fin chrono / capture / remontage', () => {
  it('Effort → validate → chrono → Reprendre : nombre de séries inchangé', async () => {
    const free: ExerciseEntry[] = [
      {
        id: 'ex-incline',
        name: 'Développé incliné',
        canonicalExerciseId: 'incline_bench_press',
        sets: [
          { reps: 8, weightKg: 20 },
          { reps: 8, weightKg: 20 },
        ],
      },
    ]
    await renderLive(free)
    expect(setCount()).toBe(2)

    await enterEffort(0, '5')
    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()
    expect(setCount()).toBe(2)

    await clickReprendre()
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    expect(setCount()).toBe(2)
    expect(host.textContent).toContain('5/10')
    expect(host.textContent).not.toContain('RPE')
  })

  it('Effort → validate → fin naturelle du chrono : nombre de séries inchangé', async () => {
    vi.useFakeTimers()
    const free: ExerciseEntry[] = [
      {
        id: 'ex-natural',
        name: 'Développé incliné',
        canonicalExerciseId: 'incline_bench_press',
        sets: [{ reps: 8, weightKg: 20 }],
      },
    ]
    await renderLive(free)
    expect(setCount()).toBe(1)

    await enterEffort(0, '8')
    expect(host.querySelector('[data-recovery-timer]')).toBeTruthy()
    expect(setCount()).toBe(1)

    // preferredRestSec mock = 90 — avance au-delà de la fin
    await act(async () => {
      vi.advanceTimersByTime(95_000)
    })
    expect(host.querySelector('[data-recovery-timer]')).toBeNull()
    expect(setCount()).toBe(1)
  })

  it('capture : série 3 !done + série 4 done + Reprendre n’ajoute pas de série 5', async () => {
    /**
     * Capture prod : séries 1/2/4 validées, 3 active (effort saisi), 5 fantôme.
     * Ancien bug : Reprendre sur la dernière série (index 3) appendait une copie
     * avec rpe de la dernière (ici 5) → série 5 « Effort 5 ».
     */
    const capture: ExerciseEntry[] = [
      {
        id: 'ex-capture',
        name: 'Développé incliné',
        canonicalExerciseId: 'incline_bench_press',
        sets: [
          { reps: 8, weightKg: 20, done: true, rpe: 5 },
          { reps: 8, weightKg: 20, done: true, rpe: 8 },
          { reps: 8, weightKg: 20, rpe: 8 },
          { reps: 8, weightKg: 20, done: true, rpe: 5, restSec: 75 },
        ],
      },
    ]
    await renderLive(capture)
    expect(setCount()).toBe(4)
    expect(host.querySelectorAll('[data-set-row="done"]')).toHaveLength(3)
    expect(host.querySelector('[data-set-row="active"]')).toBeTruthy()

    // Rejouer le skip repos de la série 4 (comme après Reprendre)
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('ranked-gym:rest-logged', {
          detail: {
            target: {
              exerciseId: 'ex-capture',
              setIndex: 3,
              exerciseName: 'Développé incliné',
              setLabel: 'S4',
            },
            restSec: 75,
            skipped: true,
          },
        }),
      )
    })
    // LiveTrainHarness écoute → restLogRequest ; laisser le render partir
    await act(async () => {
      await Promise.resolve()
    })
    expect(setCount()).toBe(4)
  })

  it('reprise après arrière-plan / remount : aucune série dupliquée ni ajoutée', async () => {
    const free: ExerciseEntry[] = [
      {
        id: 'ex-bg',
        name: 'Développé incliné',
        canonicalExerciseId: 'incline_bench_press',
        sets: [
          { reps: 8, weightKg: 20 },
          { reps: 8, weightKg: 20 },
          { reps: 8, weightKg: 20 },
        ],
      },
    ]
    await renderLive(free)
    await enterEffort(0, '5')
    expect(setCount()).toBe(3)
    await clickReprendre()
    expect(setCount()).toBe(3)

    // Flush brouillon (visibilitychange) puis remount comme soft-leave → Reprendre
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(lastDraftExercises[0]?.sets).toHaveLength(3)
    expect(lastDraftExercises[0]?.sets.filter((s) => s.done)).toHaveLength(1)

    await act(async () => {
      root.unmount()
    })
    root = createRoot(host)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    draftHolder.current = liveDraft(0)
    await renderLive(lastDraftExercises)

    expect(setCount()).toBe(3)
    expect(host.querySelectorAll('[data-set-row="done"]')).toHaveLength(1)
    expect(host.textContent).toContain('5/10')
  })

  it('live : + Ajouter une série reste le seul chemin d’ajout', async () => {
    const one: ExerciseEntry[] = [
      {
        id: 'ex-manual',
        name: 'Presse',
        canonicalExerciseId: 'leg_press',
        sets: [{ reps: 10, weightKg: 100 }],
      },
    ]
    await renderLive(one)
    await enterEffort(0, '7')
    await clickReprendre()
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
