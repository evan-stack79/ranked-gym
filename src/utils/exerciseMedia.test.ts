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
  })

  it('résout l’asset local bench press / développé couché', () => {
    const media = resolveExerciseMedia('Développé couché')
    expect(media.slug).toBe('developpe-couche')
    expect(media.imageSrc).toBeTruthy()
    expect(media.muscles).toEqual(['Pectoraux', 'Triceps'])
    expect(formatExerciseMuscles(media.muscles)).toBe('Pectoraux · Triceps')
  })

  it('alias bench → même asset', () => {
    expect(resolveExerciseMedia('bench').imageSrc).toBe(
      resolveExerciseMedia('Développé couché').imageSrc,
    )
  })

  it('fallback sobre si exercice inconnu', () => {
    const media = resolveExerciseMedia('Soulevé de terre')
    expect(media.slug).toBe('souleve-de-terre')
    expect(media.imageSrc).toBeNull()
    expect(media.muscles).toEqual([])
  })
})
