import { describe, expect, it } from 'vitest'
import type { ExerciseEntry } from '../types/training'
import { resolvePickerIllustrationSrc } from './exercisePickerIllustrations'
import { resolveHistoryIllustration } from './historySessionIllustration'

function ex(partial: Partial<ExerciseEntry> & Pick<ExerciseEntry, 'id'>): ExerciseEntry {
  return {
    name: '',
    sets: [{ reps: 5, weightKg: 80 }],
    ...partial,
  }
}

describe('resolveHistoryIllustration', () => {
  it('1 exo id canonique wave1 → PNG locale exacte', () => {
    const hit = resolveHistoryIllustration({
      exercises: [ex({ id: '1', name: 'Squat', canonicalExerciseId: 'back_squat' })],
    })
    expect(hit.state).toBe('canonical')
    expect(hit.canonicalId).toBe('back_squat')
    expect(hit.src).toBe(resolvePickerIllustrationSrc('back_squat'))
    expect(hit.src).toMatch(/back-squat/i)
  })

  it('1 exo bench_press → webp validé du manifeste, pas une PNG wave1', () => {
    const hit = resolveHistoryIllustration({
      exercises: [
        ex({ id: '1', name: 'Développé couché', canonicalExerciseId: 'bench_press' }),
      ],
    })
    expect(hit.state).toBe('canonical')
    expect(hit.src).toMatch(/developpe-couche/i)
    expect(hit.src).not.toMatch(/\.png(\?|$)/i)
  })

  it('plusieurs exos → visuel neutre, jamais la 1re illu', () => {
    const hit = resolveHistoryIllustration({
      exercises: [
        ex({ id: '1', name: 'Squat', canonicalExerciseId: 'back_squat' }),
        ex({ id: '2', name: 'Développé couché', canonicalExerciseId: 'bench_press' }),
      ],
    })
    expect(hit).toEqual({ src: null, state: 'multi', canonicalId: null })
  })

  it('custom / id inconnu → fallback graphite', () => {
    expect(
      resolveHistoryIllustration({
        exercises: [ex({ id: '1', name: 'Mon exo perso' })],
      }).state,
    ).toBe('fallback')
    expect(
      resolveHistoryIllustration({
        exercises: [ex({ id: '1', name: 'Planche', canonicalExerciseId: 'plank' })],
      }),
    ).toEqual({ src: null, state: 'fallback', canonicalId: 'plank' })
    expect(
      resolveHistoryIllustration({
        exercises: [ex({ id: '1', name: 'X', canonicalExerciseId: 'unknown_move_xyz' })],
      }).state,
    ).toBe('fallback')
  })

  it('jamais de fuzzy sur le nom', () => {
    expect(
      resolveHistoryIllustration({
        exercises: [ex({ id: '1', name: 'Squat' })],
      }),
    ).toEqual({ src: null, state: 'fallback', canonicalId: null })
    expect(
      resolveHistoryIllustration({
        exercises: [ex({ id: '1', name: 'back_squat' })],
      }).src,
    ).toBeNull()
    expect(
      resolveHistoryIllustration({
        exercises: [ex({ id: '1', name: 'Développé couché' })],
      }).src,
    ).toBeNull()
  })
})
