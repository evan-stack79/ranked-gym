import { describe, expect, it } from 'vitest'
import {
  isSetReadyForAutoValidate,
  makeAutoValidateKey,
  nextSetHint,
  shouldCommitAutoValidate,
} from './autoValidateSet'

describe('isSetReadyForAutoValidate', () => {
  it('refuse charge/reps manquantes ou Effort absent', () => {
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: 20 })).toBe(false)
    expect(isSetReadyForAutoValidate({ reps: 0, weightKg: 20, difficulty: 'ok' })).toBe(false)
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: Number.NaN, difficulty: 'ok' })).toBe(false)
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: 20, difficulty: 'ok', done: true })).toBe(
      false,
    )
  })

  it('accepte Effort sélectionné avec charge/reps valides (0 kg autorisé)', () => {
    expect(isSetReadyForAutoValidate({ reps: 10, weightKg: 0, difficulty: 'easy' })).toBe(true)
    expect(isSetReadyForAutoValidate({ reps: 6, weightKg: 80, difficulty: 'hard' })).toBe(true)
  })
})

describe('shouldCommitAutoValidate', () => {
  const key = makeAutoValidateKey('ex-1', 0, { reps: 8, weightKg: 20, difficulty: 'ok' })

  it('valide une seule fois (anti-doublon re-render)', () => {
    expect(
      shouldCommitAutoValidate({ ready: true, done: false, key, lastKey: null }),
    ).toBe(true)
    expect(
      shouldCommitAutoValidate({ ready: true, done: false, key, lastKey: key }),
    ).toBe(false)
    expect(
      shouldCommitAutoValidate({ ready: true, done: true, key, lastKey: null }),
    ).toBe(false)
  })
})

describe('nextSetHint', () => {
  it('indique la série suivante du même exercice', () => {
    const hint = nextSetHint(
      [
        {
          id: 'ex-1',
          name: 'Développé couché',
          sets: [{ done: true }, { done: false }],
        },
      ],
      'ex-1',
      0,
    )
    expect(hint).toEqual({ exerciseName: 'Développé couché', setLabel: 'Série 2' })
  })

  it('n’avance pas à l’exercice suivant tant qu’il reste une série', () => {
    const hint = nextSetHint(
      [
        {
          id: 'ex-1',
          name: 'Développé couché',
          sets: [{ done: true }, { done: false }],
        },
        {
          id: 'ex-2',
          name: 'Row barre',
          sets: [{ done: false }],
        },
      ],
      'ex-1',
      0,
    )
    expect(hint).toEqual({ exerciseName: 'Développé couché', setLabel: 'Série 2' })
  })
})
