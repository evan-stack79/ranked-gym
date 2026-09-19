// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  exerciseSlug,
  formatExerciseMuscles,
  resolveExerciseMedia,
} from './exerciseMedia'

describe('exerciseMedia', () => {
  it('normalise Développé couché vers developpe-couche', () => {
    expect(exerciseSlug('Développé couché')).toBe('developpe-couche')
    expect(exerciseSlug('  Bench Press ')).toBe('bench-press')
    expect(exerciseSlug('DÉVELOPPER')).toBe('developper')
  })

  it('résout l’asset local via nom fiable (développé couché)', () => {
    const media = resolveExerciseMedia('Développé couché')
    expect(media.canonicalExerciseId).toBe('bench_press')
    expect(media.slug).toBe('bench_press')
    expect(media.imageSrc).toBeTruthy()
    expect(media.imageSrc).toMatch(/developpe-couche/i)
    expect(media.imageAlt).toMatch(/développé couché/i)
    expect(media.muscles).toEqual(['Pectoraux', 'Triceps'])
    expect(formatExerciseMuscles(media.muscles)).toBe('Pectoraux · Triceps')
  })

  it('résout via canonicalExerciseId prioritaire sur le titre libre', () => {
    const media = resolveExerciseMedia({
      name: 'DÉVELOPPER',
      canonicalExerciseId: 'bench_press',
    })
    expect(media.canonicalExerciseId).toBe('bench_press')
    expect(media.imageSrc).toBeTruthy()
    expect(media.muscles).toEqual(['Pectoraux', 'Triceps'])
  })

  it('alias bench → même asset', () => {
    expect(resolveExerciseMedia('bench').imageSrc).toBe(
      resolveExerciseMedia('Développé couché').imageSrc,
    )
  })

  it('ne mappe PAS le titre ambigu DÉVELOPPER vers bench_press', () => {
    const media = resolveExerciseMedia('DÉVELOPPER')
    expect(media.slug).toBe('developper')
    expect(media.canonicalExerciseId).toBeNull()
    expect(media.imageSrc).toBeNull()
    expect(media.muscles).toEqual([])
  })

  it('fallback sobre si exercice inconnu', () => {
    const media = resolveExerciseMedia('Soulevé de terre')
    expect(media.slug).toBe('souleve-de-terre')
    expect(media.imageSrc).toBeNull()
    expect(media.muscles).toEqual([])
  })

  it('leg_press réservé → pas d’asset encore', () => {
    const media = resolveExerciseMedia({ canonicalExerciseId: 'leg_press' })
    expect(media.canonicalExerciseId).toBe('leg_press')
    expect(media.imageSrc).toBeNull()
  })
})
