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
})
