import { describe, expect, it } from 'vitest'
import {
  clampPercent,
  computeProgramProgressPercent,
  computeSessionProgressPercent,
  countTotalSets,
  deriveGalleryHeroCards,
  deriveGalleryProgramTiles,
  formatGalleryRecentMeta,
  resolveGalleryCoverSrc,
} from './accueilGallery'
import type { TrainingState, WorkoutRoutine } from '../types/training'

function routine(partial: Partial<WorkoutRoutine> & Pick<WorkoutRoutine, 'id' | 'label'>): WorkoutRoutine {
  return {
    subtitle: '',
    accent: '#FF2B2B',
    exercises: [],
    updatedAt: 1,
    ...partial,
  }
}

function baseState(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
    routines: [],
    schedule: [],
    workoutNotes: [],
    completedSessions: [],
    templates: [],
    lastSelectedRoutineId: null,
    lastSelectedSportId: null,
    primarySportId: 'musculation',
    ...overrides,
  } as TrainingState
}

describe('accueilGallery progress', () => {
  it('clampPercent bounds', () => {
    expect(clampPercent(-5)).toBe(0)
    expect(clampPercent(150)).toBe(100)
    expect(clampPercent(33.4)).toBe(33)
    expect(clampPercent(Number.NaN)).toBe(0)
  })

  it('countTotalSets counts planned sets', () => {
    expect(
      countTotalSets(
        routine({
          id: 'push',
          label: 'Push',
          exercises: [
            { id: 'a', name: 'A', sets: [{ reps: 8, weightKg: 40 }, { reps: 8, weightKg: 40 }] },
            { id: 'b', name: 'B', sets: [{ reps: 10, weightKg: 20 }] },
          ],
        }),
      ),
    ).toBe(3)
  })

  it('session progress from active draft done/total', () => {
    const state = baseState({
      routines: [
        routine({
          id: 'push',
          label: 'Push',
          exercises: [
            {
              id: 'a',
              name: 'Bench',
              sets: [
                { reps: 8, weightKg: 60, done: true },
                { reps: 8, weightKg: 60, done: true },
                { reps: 8, weightKg: 60 },
                { reps: 8, weightKg: 60 },
              ],
            },
          ],
        }),
      ],
      activeWorkoutDraft: {
        routineId: 'push',
        sportId: 'musculation',
        startedAt: 1,
        updatedAt: 1,
      },
    })
    expect(computeSessionProgressPercent(state)).toBe(50)
  })

  it('program progress uses filled routines when no schedule', () => {
    const state = baseState({
      routines: [
        routine({
          id: 'push',
          label: 'Push',
          exercises: [{ id: 'a', name: 'A', sets: [{ reps: 8, weightKg: 40 }] }],
        }),
        routine({ id: 'pull', label: 'Pull', exercises: [] }),
        routine({ id: 'legs', label: 'Legs', exercises: [] }),
        routine({ id: 'full', label: 'Full', exercises: [] }),
      ],
      schedule: [],
    })
    // push_pull split from routine ids → 4 routines, 1 ready → 25%
    expect(computeProgramProgressPercent(state)).toBe(25)
  })

  it('hero cards expose session + program only (no body metrics)', () => {
    const cards = deriveGalleryHeroCards(baseState())
    expect(cards.map((c) => c.id)).toEqual(['session', 'program'])
    expect(cards.every((c) => c.progressPercent >= 0 && c.progressPercent <= 100)).toBe(true)
    const blob = JSON.stringify(cards)
    expect(blob).not.toMatch(/kcal|calories|poids|body\s*fat|graisse/i)
  })

  it('hero session cover uses first illustratable exercise even with multi-exo routine', () => {
    const cards = deriveGalleryHeroCards(
      baseState({
        routines: [
          routine({
            id: 'push',
            label: 'Push',
            exercises: [
              {
                id: 'a',
                name: 'Développé couché',
                canonicalExerciseId: 'bench_press',
                sets: [{ reps: 8, weightKg: 60 }],
              },
              {
                id: 'b',
                name: 'Développé militaire',
                sets: [{ reps: 10, weightKg: 30 }],
              },
            ],
          }),
        ],
        schedule: [
          {
            id: 'sch-1',
            templateId: 'tpl-push',
            title: 'Push',
            days: [new Date().getDay() as import('../types/training').Weekday],
            time: '18:00',
            enabled: true,
            sportId: 'musculation',
            sessionKind: 'strength',
          },
        ],
      }),
    )
    const session = cards.find((c) => c.id === 'session')
    expect(session?.imageSrc).toMatch(/developpe-couche/i)
    expect(cards.find((c) => c.id === 'program')?.imageSrc).toBeNull()
  })

  it('resolveGalleryCoverSrc picks first bundled illustration', () => {
    expect(
      resolveGalleryCoverSrc([
        {
          id: 'a',
          name: 'Développé couché',
          canonicalExerciseId: 'bench_press',
          sets: [{ reps: 8, weightKg: 60 }],
        },
      ]),
    ).toMatch(/developpe-couche/i)
    expect(
      resolveGalleryCoverSrc([
        { id: 'x', name: 'Custom', sets: [{ reps: 8, weightKg: 20 }] },
      ]),
    ).toBeNull()
  })

  it('program tiles expose cover from first illustratable exercise', () => {
    const tiles = deriveGalleryProgramTiles(
      baseState({
        routines: [
          routine({
            id: 'push',
            label: 'Push',
            exercises: [
              {
                id: 'a',
                name: 'Développé couché',
                canonicalExerciseId: 'bench_press',
                sets: [{ reps: 8, weightKg: 60 }],
              },
              {
                id: 'b',
                name: 'Autre',
                sets: [{ reps: 10, weightKg: 20 }],
              },
            ],
          }),
          routine({
            id: 'pull',
            label: 'Pull',
            exercises: [{ id: 'c', name: 'Tractions', sets: [{ reps: 6, weightKg: 0 }] }],
          }),
        ],
      }),
    )
    const push = tiles.find((t) => t.id === 'push')
    expect(push?.imageSrc).toMatch(/developpe-couche/i)
    expect(tiles.find((t) => t.id === 'pull')?.imageSrc).toBeNull()
  })

  it('recent meta has no calorie or weight numbers', () => {
    const line = formatGalleryRecentMeta({
      id: '1',
      title: 'Push',
      sportLabel: 'Musculation',
      dateLabel: 'Hier',
      summary: '4 exos · 12 séries · 45 min',
      note: {
        id: '1',
        title: 'Push',
        dateKey: '2026-10-06',
        createdAt: 1,
        estimatedKcal: 400,
        totalVolumeKg: 1200,
        exercises: [],
      },
    })
    expect(line).toBe('Hier · 4 exos · 12 séries · 45 min')
    expect(line).not.toMatch(/kcal|kg/i)
  })
})
