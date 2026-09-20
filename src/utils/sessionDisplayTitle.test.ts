import { describe, expect, it } from 'vitest'
import type { ExerciseEntry, WorkoutNote } from '../types/training'
import {
  deriveSessionDisplayTitle,
  deriveSessionTitleFromExercises,
  isUnprovenBicepsBugTitle,
  namedSessionExercises,
  resolveExerciseDisplayName,
  resolvePersistedSessionTitle,
  MULTI_EXERCISE_SESSION_TITLE,
  UNPROVEN_INHERITED_TITLE,
} from './sessionDisplayTitle'

function ex(partial: Partial<ExerciseEntry> & Pick<ExerciseEntry, 'id'>): ExerciseEntry {
  return {
    name: '',
    sets: [{ reps: 8, weightKg: 60 }],
    ...partial,
  }
}

const squat = ex({ id: '1', name: 'Squat', canonicalExerciseId: 'back_squat' })
const bench = ex({
  id: '2',
  name: 'Développé couché',
  canonicalExerciseId: 'bench_press',
})

describe('deriveSessionTitleFromExercises', () => {
  it('1. séance seulement Squat → « Squat »', () => {
    expect(deriveSessionTitleFromExercises([squat])).toBe('Squat')
  })

  it('2. séance seulement Développé couché → « Développé couché »', () => {
    expect(deriveSessionTitleFromExercises([bench])).toBe('Développé couché')
  })

  it('3. plusieurs exercices → « Séance musculation »', () => {
    expect(deriveSessionTitleFromExercises([squat, bench])).toBe(MULTI_EXERCISE_SESSION_TITLE)
  })

  it('jamais un muscle / Biceps comme titre dérivé', () => {
    expect(deriveSessionTitleFromExercises([squat])).not.toBe(UNPROVEN_INHERITED_TITLE)
    expect(deriveSessionTitleFromExercises([bench, squat])).not.toBe(UNPROVEN_INHERITED_TITLE)
  })

  it('catalogue via id canonique même si name local diverge', () => {
    expect(
      resolveExerciseDisplayName(ex({ id: '1', name: 'x', canonicalExerciseId: 'bench_press' })),
    ).toBe('Développé couché')
  })

  it('ignore les lignes vides', () => {
    expect(namedSessionExercises([ex({ id: '1', name: '  ' })])).toHaveLength(0)
  })
})

describe('deriveSessionDisplayTitle — nom perso + legacy Biceps', () => {
  it('4. nom personnalisé explicite → conservé (accents, casse)', () => {
    expect(
      deriveSessionDisplayTitle({
        exercises: [squat, bench],
        title: 'Push du soir',
        titleSource: 'user',
        sessionKind: 'strength',
      }),
    ).toBe('Push du soir')
    expect(
      deriveSessionDisplayTitle({
        exercises: [squat],
        title: 'Séance Été',
        titleSource: 'user',
        sessionKind: 'strength',
      }),
    ).toBe('Séance Été')
  })

  it('legacy titre Biceps + 1 exo → nom de l’exo (UI only)', () => {
    expect(
      deriveSessionDisplayTitle({
        exercises: [squat],
        title: 'Biceps',
        sessionKind: 'strength',
      }),
    ).toBe('Squat')
    expect(
      deriveSessionDisplayTitle({
        exercises: [bench],
        title: 'Biceps',
      }),
    ).toBe('Développé couché')
  })

  it('legacy titre Biceps + multi → Séance musculation', () => {
    expect(
      deriveSessionDisplayTitle({
        exercises: [squat, bench],
        title: 'Biceps',
      }),
    ).toBe(MULTI_EXERCISE_SESSION_TITLE)
  })

  it('legacy titre volontaire non-Biceps → conservé (origine non prouvée ≠ bug)', () => {
    expect(
      deriveSessionDisplayTitle({
        exercises: [bench],
        title: 'Push du soir',
      }),
    ).toBe('Push du soir')
  })

  it('titleSource user + Biceps → conservé (nom volontaire prouvé)', () => {
    expect(
      deriveSessionDisplayTitle({
        exercises: [squat],
        title: 'Biceps',
        titleSource: 'user',
        sessionKind: 'strength',
      }),
    ).toBe('Biceps')
    expect(isUnprovenBicepsBugTitle('Biceps', 'user')).toBe(false)
    expect(isUnprovenBicepsBugTitle('Biceps', undefined)).toBe(true)
  })

  it('endurance : ne pas remplacer le titre par le nom d’exo', () => {
    expect(
      deriveSessionDisplayTitle({
        exercises: [{ id: 'e', name: '5 km', sets: [{ reps: 30, weightKg: 0 }] }],
        title: 'Course 5 km',
        sessionKind: 'endurance',
      }),
    ).toBe('Course 5 km')
  })
})

describe('resolvePersistedSessionTitle', () => {
  it('nouvelle séance Squat héritant Biceps → stocke Squat, pas Biceps', () => {
    const next = resolvePersistedSessionTitle({
      exercises: [squat],
      title: 'Biceps',
      titleSource: 'derived',
      sessionKind: 'strength',
    })
    expect(next).toEqual({ title: 'Squat', titleSource: 'derived' })
  })

  it('nouvelle séance multi → Séance musculation', () => {
    expect(
      resolvePersistedSessionTitle({
        exercises: [squat, bench],
        title: 'Biceps',
        sessionKind: 'strength',
      }).title,
    ).toBe(MULTI_EXERCISE_SESSION_TITLE)
  })

  it('nouvelle séance nom perso → conservé', () => {
    expect(
      resolvePersistedSessionTitle({
        exercises: [squat],
        title: 'Push du soir',
        titleSource: 'user',
        sessionKind: 'strength',
      }),
    ).toEqual({ title: 'Push du soir', titleSource: 'user' })
  })

  it('édition d’une ancienne note Biceps → ne réécrit pas le stocké', () => {
    const existing: Pick<WorkoutNote, 'title' | 'titleSource'> = { title: 'Biceps' }
    expect(
      resolvePersistedSessionTitle(
        {
          exercises: [squat],
          title: 'Biceps',
          sessionKind: 'strength',
        },
        existing,
      ),
    ).toEqual({ title: 'Biceps' })
  })
})
