// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkoutNote } from '../../types/training'
import { WorkoutHistory } from './WorkoutHistory'

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

async function renderHistory(note: WorkoutNote) {
  await act(async () => {
    root.render(
      <WorkoutHistory
        notes={[note]}
        onDelete={vi.fn()}
        focusNoteId={note.id}
      />,
    )
  })
  return document.body.textContent ?? ''
}

describe('WorkoutHistory — métriques multisport réelles', () => {
  it('ne transforme jamais les répétitions d’une course sans durée en minutes', async () => {
    const text = await renderHistory({
      id: 'run-without-duration',
      title: 'Course sans mesure',
      dateKey: '2026-09-04',
      createdAt: Date.parse('2026-09-04T15:00:00Z'),
      estimatedKcal: 0,
      durationMin: 0,
      totalVolumeKg: 0,
      sportId: 'course-a-pied',
      sessionKind: 'endurance',
      source: 'manual',
      exercises: [
        {
          id: 'run',
          name: 'Course',
          sets: [{ reps: 42, weightKg: 0 }],
        },
      ],
    })

    expect(text).toContain('Durée non renseignée')
    expect(text).toContain('Mesure non renseignée')
    expect(text).not.toContain('15 min')
    expect(text).not.toContain('42 min')
    expect(text).not.toContain('kcal')
    expect(text).not.toContain('kg')
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('undefined')
  })

  it('préserve le fallback des anciennes séances de musculation chargées', async () => {
    const text = await renderHistory({
      id: 'legacy-strength',
      title: 'Musculation legacy',
      dateKey: '2026-09-04',
      createdAt: Date.parse('2026-09-04T15:00:00Z'),
      estimatedKcal: 120,
      exercises: [
        {
          id: 'bench',
          name: 'Développé couché',
          sets: [{ reps: 8, weightKg: 50 }],
        },
      ],
    })

    expect(text).toContain('15 min')
    expect(text).toContain('400 kg')
    expect(text).toContain('8 reps × 50 kg')
    expect(text).toContain('120 kcal')
  })

  it('carte Squat : titre réel même si stocké « Biceps »', async () => {
    const text = await renderHistory({
      id: 'squat-biceps-bug',
      title: 'Biceps',
      dateKey: '2026-09-04',
      createdAt: Date.parse('2026-09-04T15:00:00Z'),
      estimatedKcal: 210,
      durationMin: 20,
      totalVolumeKg: 500,
      sessionKind: 'strength',
      exercises: [
        {
          id: 'sq',
          name: 'Squat',
          canonicalExerciseId: 'back_squat',
          sets: [{ reps: 5, weightKg: 100 }],
        },
      ],
    })
    expect(text).toContain('Squat')
    expect(text).not.toMatch(/\bBiceps\b/)
    expect(text).toContain('500 kg')
    expect(text).toContain('20 min')
    expect(text).toContain('210 kcal')
  })

  it('carte Développé couché : titre réel même si stocké « Biceps »', async () => {
    const text = await renderHistory({
      id: 'bench-biceps-bug',
      title: 'Biceps',
      dateKey: '2026-09-04',
      createdAt: Date.parse('2026-09-04T16:00:00Z'),
      estimatedKcal: 180,
      durationMin: 18,
      totalVolumeKg: 480,
      sessionKind: 'strength',
      exercises: [
        {
          id: 'dc',
          name: 'Développé couché',
          canonicalExerciseId: 'bench_press',
          sets: [{ reps: 8, weightKg: 60 }],
        },
      ],
    })
    expect(text).toContain('Développé couché')
    expect(text).not.toMatch(/\bBiceps\b/)
  })

  it('plusieurs exercices sans nom perso → Séance musculation', async () => {
    const text = await renderHistory({
      id: 'multi',
      title: 'Biceps',
      dateKey: '2026-09-04',
      createdAt: Date.parse('2026-09-04T17:00:00Z'),
      estimatedKcal: 300,
      sessionKind: 'strength',
      exercises: [
        {
          id: 'sq',
          name: 'Squat',
          canonicalExerciseId: 'back_squat',
          sets: [{ reps: 5, weightKg: 100 }],
        },
        {
          id: 'dc',
          name: 'Développé couché',
          canonicalExerciseId: 'bench_press',
          sets: [{ reps: 8, weightKg: 60 }],
        },
      ],
    })
    expect(text).toContain('Séance musculation')
    expect(text).not.toMatch(/\bBiceps\b/)
  })

  it('nom personnalisé conservé', async () => {
    const text = await renderHistory({
      id: 'custom',
      title: 'Push du soir',
      titleSource: 'user',
      dateKey: '2026-09-04',
      createdAt: Date.parse('2026-09-04T18:00:00Z'),
      estimatedKcal: 200,
      sessionKind: 'strength',
      exercises: [
        {
          id: 'dc',
          name: 'Développé couché',
          canonicalExerciseId: 'bench_press',
          sets: [{ reps: 8, weightKg: 60 }],
        },
      ],
    })
    expect(text).toContain('Push du soir')
  })
})
