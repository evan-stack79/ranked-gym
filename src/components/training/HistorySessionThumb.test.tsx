/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WorkoutNote } from '../../types/training'
import { HistorySessionThumb } from './HistorySessionThumb'

type NoteFixture = Pick<WorkoutNote, 'id' | 'title'> &
  Partial<Omit<WorkoutNote, 'id' | 'title'>>

function note({
  id,
  title,
  dateKey = '2026-10-06',
  createdAt = 1,
  exercises = [],
  estimatedKcal = 0,
  ...rest
}: NoteFixture): WorkoutNote {
  return {
    id,
    title,
    dateKey,
    createdAt,
    exercises,
    estimatedKcal,
    ...rest,
  }
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

describe('HistorySessionThumb', () => {
  it('row variant keeps compact object-contain thumb', async () => {
    await act(async () => {
      root.render(
        <HistorySessionThumb
          note={note({
            id: 'n1',
            title: 'Développé couché',
            exercises: [
              {
                id: 'e1',
                name: 'Développé couché',
                canonicalExerciseId: 'bench_press',
                sets: [{ reps: 8, weightKg: 60 }],
              },
            ],
          })}
        />,
      )
    })
    const thumb = host.querySelector('[data-history-thumb]') as HTMLElement
    expect(thumb.getAttribute('data-history-thumb-variant')).toBe('row')
    expect(thumb.style.width).toBe('44px')
    const img = host.querySelector('img')
    expect(img?.className).toMatch(/object-contain/)
    expect(img?.className).not.toMatch(/object-cover/)
  })

  it('tile variant fills parent with object-cover', async () => {
    await act(async () => {
      root.render(
        <div style={{ position: 'relative', width: 124, height: 124 }}>
          <HistorySessionThumb
            variant="tile"
            note={note({
              id: 'n2',
              title: 'Développé couché',
              exercises: [
                {
                  id: 'e1',
                  name: 'Développé couché',
                  canonicalExerciseId: 'bench_press',
                  sets: [{ reps: 8, weightKg: 60 }],
                },
              ],
            })}
          />
        </div>,
      )
    })
    const thumb = host.querySelector('[data-history-thumb]') as HTMLElement
    expect(thumb.getAttribute('data-history-thumb-variant')).toBe('tile')
    expect(thumb.className).toMatch(/history-thumb--tile/)
    const img = host.querySelector('[data-history-thumb-img="cover"]')
    expect(img?.className).toMatch(/object-cover/)
    expect(img?.className).toMatch(/h-full/)
    expect(img?.className).toMatch(/w-full/)
  })

  it('tile variant shows centered dumbbell only when no image', async () => {
    await act(async () => {
      root.render(
        <div style={{ position: 'relative', width: 124, height: 124 }}>
          <HistorySessionThumb
            variant="tile"
            note={note({
              id: 'n3',
              title: 'Custom',
              exercises: [
                { id: 'e1', name: 'Mouvement maison', sets: [{ reps: 8, weightKg: 20 }] },
              ],
            })}
          />
        </div>,
      )
    })
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('[data-history-thumb-fallback]')).toBeTruthy()
    expect(host.querySelector('[data-history-thumb-state="fallback"]')).toBeTruthy()
  })
})
