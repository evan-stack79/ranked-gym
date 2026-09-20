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

    const detail = document.body.querySelector('[data-history-detail="run-without-duration"]')
    expect(detail).toBeTruthy()
    expect(detail?.querySelector('[data-history-metric="duration"]')?.textContent).toBe('—')
    expect(detail?.querySelector('[data-history-metric="volume"]')?.textContent).toBe('—')
    expect(detail?.querySelector('[data-history-metric="kcal"]')?.textContent).toBe('—')
    expect(detail?.querySelector('[data-history-set="weight"]')?.textContent).toBe('—')
    expect(detail?.querySelector('[data-history-set="reps"]')?.textContent).toBe('—')
    expect(detail?.querySelector('[data-history-set="effort"]')?.textContent).toBe('—')
    expect(text).not.toContain('Durée non renseignée')
    expect(text).not.toContain('Mesure non renseignée')
    expect(text).not.toContain('15 min')
    expect(text).not.toContain('42 min')
    expect(text).not.toContain('0 kg')
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

    const detail = document.body.querySelector('[data-history-detail="legacy-strength"]')
    expect(text).toContain('15 min')
    expect(text).toContain('400 kg')
    expect(text).toContain('120 kcal')
    expect(detail?.querySelector('[data-history-set="weight"]')?.textContent).toBe('50 kg')
    expect(detail?.querySelector('[data-history-set="reps"]')?.textContent).toBe('8')
    expect(detail?.querySelector('[data-history-set="effort"]')?.textContent).toBe('—')
    expect(text).not.toContain('8 reps × 50 kg')
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

  it('lignes compactes : pas de tuile rouge, pas d’orange kcal, illu wave1', async () => {
    await act(async () => {
      root.render(
        <WorkoutHistory
          notes={[
            {
              id: 'squat-line',
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
            },
            {
              id: 'custom-line',
              title: 'Perso',
              titleSource: 'user',
              dateKey: '2026-09-04',
              createdAt: Date.parse('2026-09-04T14:00:00Z'),
              estimatedKcal: 0,
              durationMin: 0,
              totalVolumeKg: 0,
              sessionKind: 'strength',
              exercises: [
                {
                  id: 'custom',
                  name: 'Mon exo perso',
                  sets: [{ reps: 8, weightKg: 0 }],
                },
              ],
            },
            {
              id: 'multi-line',
              title: 'Biceps',
              dateKey: '2026-09-04',
              createdAt: Date.parse('2026-09-04T13:00:00Z'),
              estimatedKcal: 300,
              durationMin: 40,
              totalVolumeKg: 980,
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
            },
          ]}
          onDelete={vi.fn()}
        />,
      )
    })

    const squatRow = host.querySelector('[data-history-row="squat-line"]')
    expect(squatRow).toBeTruthy()
    expect(squatRow?.querySelector('[data-history-thumb-state="canonical"]')).toBeTruthy()
    expect(squatRow?.querySelector('img')?.getAttribute('src')).toMatch(/back-squat/i)
    expect(squatRow?.textContent).toContain('Squat')
    expect(squatRow?.textContent).not.toMatch(/\bBiceps\b/)
    expect(squatRow?.textContent).toContain('210 kcal')
    expect(squatRow?.innerHTML).not.toContain('FF9F0A')
    expect(squatRow?.className).not.toMatch(/glass-card/)
    expect(host.querySelector('[class*="FF2B2B"]')).toBeNull()

    const customRow = host.querySelector('[data-history-row="custom-line"]')
    expect(customRow?.querySelector('[data-history-thumb-state="fallback"]')).toBeTruthy()
    expect(customRow?.querySelector('img')).toBeNull()
    expect(customRow?.textContent).not.toContain('kcal')
    expect(customRow?.textContent).not.toContain(' kg')

    const multiRow = host.querySelector('[data-history-row="multi-line"]')
    expect(multiRow?.querySelector('[data-history-thumb-state="multi"]')).toBeTruthy()
    expect(multiRow?.textContent).toContain('Séance musculation')
    expect(multiRow?.textContent).toContain('Squat · Développé couché')
  })

  it('chaque ligne ouvre la séance correspondante', async () => {
    const squat: WorkoutNote = {
      id: 'open-squat',
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
    }
    const bench: WorkoutNote = {
      id: 'open-bench',
      title: 'Biceps',
      dateKey: '2026-09-04',
      createdAt: Date.parse('2026-09-04T14:00:00Z'),
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
    }
    await act(async () => {
      root.render(<WorkoutHistory notes={[squat, bench]} onDelete={vi.fn()} />)
    })
    const squatBtn = host.querySelector('[data-history-row="open-squat"]') as HTMLButtonElement
    expect(squatBtn).toBeTruthy()
    await act(async () => {
      squatBtn.click()
    })
    expect(document.body.querySelector('[data-history-detail="open-squat"]')).toBeTruthy()
    expect(document.body.querySelector('[data-history-detail="open-bench"]')).toBeNull()
    expect(document.body.textContent).toContain('Squat')
    expect(document.body.textContent).not.toMatch(/\bBiceps\b/)

    const benchBtn = host.querySelector('[data-history-row="open-bench"]') as HTMLButtonElement
    expect(benchBtn).toBeTruthy()
    await act(async () => {
      benchBtn.click()
    })
    expect(document.body.querySelector('[data-history-detail="open-bench"]')).toBeTruthy()
    expect(document.body.querySelector('[data-history-detail="open-squat"]')).toBeNull()
    expect(document.body.textContent).toContain('Développé couché')
  })

  it('état vide simple, sans carte déco', async () => {
    await act(async () => {
      root.render(<WorkoutHistory notes={[]} onDelete={vi.fn()} />)
    })
    expect(host.querySelector('[data-history-page="empty"]')).toBeTruthy()
    expect(host.textContent).toContain('Historique')
    expect(host.textContent).toMatch(/Aucune séance/)
    expect(host.querySelector('.glass-card')).toBeNull()
  })
})

describe('WorkoutHistory — fiche détail bottom sheet', () => {
  const squat: WorkoutNote = {
    id: 'detail-squat',
    title: 'Biceps',
    dateKey: '2026-09-04',
    createdAt: Date.parse('2026-09-04T16:30:00Z'),
    estimatedKcal: 210,
    durationMin: 22,
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
  }

  async function renderNotes(
    notes: WorkoutNote[],
    props?: Partial<{
      onDelete: (id: string) => void | Promise<void>
      onEdit: (note: WorkoutNote) => void
      canEdit: (note: WorkoutNote) => boolean
    }>,
  ) {
    const onDelete = props?.onDelete ?? vi.fn()
    const onEdit = props?.onEdit
    await act(async () => {
      root.render(
        <WorkoutHistory
          notes={notes}
          onDelete={onDelete}
          onEdit={onEdit}
          canEdit={props?.canEdit}
        />,
      )
    })
    return { onDelete, onEdit }
  }

  async function openRow(id: string) {
    const row = host.querySelector(`[data-history-row="${id}"]`) as HTMLButtonElement
    expect(row).toBeTruthy()
    await act(async () => {
      row.click()
    })
    return row
  }

  it('affiche titre réel, date, résumé, colonnes, sans répéter le nom d’un seul exo', async () => {
    await renderNotes([squat])
    await openRow('detail-squat')
    const detail = document.body.querySelector('[data-history-detail="detail-squat"]')
    expect(detail).toBeTruthy()
    expect(document.body.querySelector('[data-train-sheet-tone="graphite"]')).toBeTruthy()
    expect(document.body.textContent).toContain('Squat')
    expect(document.body.textContent).not.toMatch(/\bBiceps\b/)
    expect(detail?.querySelector('[data-history-metric="duration"]')?.textContent).toBe('22 min')
    expect(detail?.querySelector('[data-history-metric="volume"]')?.textContent).toBe('500 kg')
    expect(detail?.querySelector('[data-history-metric="kcal"]')?.textContent).toBe('210 kcal')
    expect(detail?.textContent).toContain('Série')
    expect(detail?.textContent).toContain('Poids')
    expect(detail?.textContent).toContain('Répétitions')
    expect(detail?.textContent).toContain('Effort')
    expect(detail?.querySelector('[data-history-set="weight"]')?.textContent).toBe('100 kg')
    expect(detail?.querySelector('[data-history-set="reps"]')?.textContent).toBe('5')
    expect(detail?.querySelector('[data-history-exercise] p')).toBeNull()
    expect(detail?.querySelector('.rounded-2xl')).toBeNull()
    expect(detail?.innerHTML).not.toContain('glass')
  })

  it('multi-exos : une section par exercice, pas de carte imbriquée', async () => {
    await renderNotes([
      {
        id: 'detail-multi',
        title: 'Biceps',
        dateKey: '2026-09-04',
        createdAt: Date.parse('2026-09-04T12:00:00Z'),
        estimatedKcal: 300,
        durationMin: 40,
        totalVolumeKg: 980,
        sessionKind: 'strength',
        exercises: [
          {
            id: 'sq',
            name: 'Squat',
            canonicalExerciseId: 'back_squat',
            sets: [{ reps: 5, weightKg: 100, difficulty: 'hard' }],
          },
          {
            id: 'dc',
            name: 'Développé couché',
            canonicalExerciseId: 'bench_press',
            sets: [{ reps: 8, weightKg: 60, difficulty: 'ok' }],
          },
        ],
      },
    ])
    await openRow('detail-multi')
    const detail = document.body.querySelector('[data-history-detail="detail-multi"]')
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(
      'Séance musculation',
    )
    expect(detail?.querySelector('[data-history-exercise="sq"]')?.textContent).toContain('Squat')
    expect(detail?.querySelector('[data-history-exercise="dc"]')?.textContent).toContain(
      'Développé couché',
    )
    expect(detail?.querySelector('[data-history-exercise="sq"] [data-history-set="effort"]')?.textContent).toBe(
      'Dur',
    )
    expect(detail?.querySelector('[data-history-exercise="dc"] [data-history-set="effort"]')?.textContent).toBe(
      'OK',
    )
    expect(detail?.querySelectorAll('.rounded-2xl').length).toBe(0)
  })

  it('menu Modifier : flux existant seulement, sinon désactivé', async () => {
    const onEdit = vi.fn()
    await renderNotes([squat], { onEdit, canEdit: (note) => note.sessionKind === 'strength' })
    await openRow('detail-squat')
    const trigger = document.body.querySelector('[data-history-menu-trigger]') as HTMLButtonElement
    await act(async () => {
      trigger.click()
    })
    const item = document.body.querySelector('[data-history-edit-available]') as HTMLButtonElement
    expect(item).toBeTruthy()
    expect(item.disabled).toBe(false)
    await act(async () => {
      item.click()
    })
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit.mock.calls[0]?.[0]?.id).toBe('detail-squat')
    expect(document.body.querySelector('[data-history-detail="detail-squat"]')).toBeNull()
  })

  it('menu Modifier désactivé sans onEdit', async () => {
    await renderNotes([squat])
    await openRow('detail-squat')
    const trigger = document.body.querySelector('[data-history-menu-trigger]') as HTMLButtonElement
    await act(async () => {
      trigger.click()
    })
    const item = document.body.querySelector('[data-history-edit-available="false"]') as HTMLButtonElement
    expect(item).toBeTruthy()
    expect(item.disabled).toBe(true)
  })

  it('suppression : confirm obligatoire, anti double-clic, échec conserve la fiche', async () => {
    const onDelete = vi.fn()
    await renderNotes([squat], { onDelete })
    await openRow('detail-squat')
    const del = document.body.querySelector('[data-history-delete]') as HTMLButtonElement
    await act(async () => {
      del.click()
    })
    expect(onDelete).not.toHaveBeenCalled()
    expect(document.body.querySelector('[data-history-delete-confirm]')).toBeTruthy()
    expect(document.body.textContent).toContain('Supprimer cette séance ?')
    expect(document.body.textContent).toContain(
      'Cette action est définitive et supprimera cette séance de ton historique.',
    )

    await act(async () => {
      ;(document.body.querySelector('[data-history-confirm-cancel]') as HTMLButtonElement).click()
    })
    expect(onDelete).not.toHaveBeenCalled()
    expect(document.body.querySelector('[data-history-delete-confirm]')).toBeNull()

    await act(async () => {
      del.click()
    })
    await act(async () => {
      ;(document.body.querySelector('[data-history-confirm-delete]') as HTMLButtonElement).click()
    })
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('detail-squat')
    expect(document.body.querySelector('[data-history-detail="detail-squat"]')).toBeNull()
  })

  it('échec delete : fiche conservée + erreur, pas de second appel pendant le pending', async () => {
    let finish!: (error?: Error) => void
    const pending = new Promise<void>((resolve, reject) => {
      finish = (error) => (error ? reject(error) : resolve())
    })
    const onDelete = vi.fn(() => pending)
    await renderNotes([squat], { onDelete })
    await openRow('detail-squat')
    await act(async () => {
      ;(document.body.querySelector('[data-history-delete]') as HTMLButtonElement).click()
    })
    const confirm = document.body.querySelector('[data-history-confirm-delete]') as HTMLButtonElement
    await act(async () => {
      confirm.click()
      confirm.click()
    })
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('Suppression…')

    await act(async () => {
      finish(new Error('server'))
      await pending.catch(() => undefined)
    })
    expect(document.body.querySelector('[data-history-detail="detail-squat"]')).toBeTruthy()
    expect(document.body.querySelector('[data-history-delete-error]')?.textContent).toContain(
      'Impossible de supprimer',
    )
  })

  it('Escape ferme la fiche et restaure le focus sur la ligne', async () => {
    await renderNotes([squat])
    const row = await openRow('detail-squat')
    expect(document.body.querySelector('[data-history-detail="detail-squat"]')).toBeTruthy()
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.body.querySelector('[data-history-detail="detail-squat"]')).toBeNull()
    expect(document.activeElement).toBe(row)
  })

  it('swipe down sur la poignée ferme la fiche', async () => {
    class TestPointerEvent extends MouseEvent {
      pointerId: number
      constructor(type: string, params: MouseEventInit & { pointerId?: number } = {}) {
        super(type, params)
        this.pointerId = params.pointerId ?? 1
      }
    }
    vi.stubGlobal('PointerEvent', TestPointerEvent)
    await renderNotes([squat])
    await openRow('detail-squat')
    const handle = document.body.querySelector('[data-sheet-handle]') as HTMLElement
    expect(handle).toBeTruthy()
    await act(async () => {
      handle.dispatchEvent(new TestPointerEvent('pointerdown', { clientY: 40, button: 0, bubbles: true }))
      handle.dispatchEvent(new TestPointerEvent('pointermove', { clientY: 160, bubbles: true }))
      handle.dispatchEvent(new TestPointerEvent('pointerup', { clientY: 160, bubbles: true }))
    })
    expect(document.body.querySelector('[data-history-detail="detail-squat"]')).toBeNull()
  })
})

