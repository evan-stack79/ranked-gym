import { describe, expect, it } from 'vitest'
import {
  isSetReadyForAutoValidate,
  isValidEffort,
  makeAutoValidateKey,
  nextSetHint,
  shouldCommitAutoValidate,
} from './autoValidateSet'

describe('isValidEffort', () => {
  it('accepte uniquement 1–10', () => {
    expect(isValidEffort(1)).toBe(true)
    expect(isValidEffort(10)).toBe(true)
    expect(isValidEffort(0)).toBe(false)
    expect(isValidEffort(11)).toBe(false)
    expect(isValidEffort('ok')).toBe(false)
    expect(isValidEffort(undefined)).toBe(false)
  })
})

describe('isSetReadyForAutoValidate', () => {
  it('refuse charge/reps manquantes ou série déjà done (Effort non requis)', () => {
    expect(isSetReadyForAutoValidate({ reps: 0, weightKg: 20 })).toBe(false)
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: Number.NaN })).toBe(false)
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: 20, done: true })).toBe(false)
  })

  it('accepte charge+reps valides sans Effort (0 kg autorisé)', () => {
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: 20 })).toBe(true)
    expect(isSetReadyForAutoValidate({ reps: 10, weightKg: 0 })).toBe(true)
    expect(isSetReadyForAutoValidate({ reps: 6, weightKg: 80 })).toBe(true)
  })
})

describe('shouldCommitAutoValidate', () => {
  const key = makeAutoValidateKey('ex-1', 0, { reps: 8, weightKg: 20 })

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
