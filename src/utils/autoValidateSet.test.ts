import { describe, expect, it } from 'vitest'
import { isAmbiguousIntegerPrefix } from '../components/nutrition/ClearableNumberInput'
import {
  isSetReadyForAutoValidate,
  isValidEffort,
  makeAutoValidateKey,
  nextSetHint,
  shouldAppendNextSetOnRestSkip,
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

describe('isAmbiguousIntegerPrefix (Effort 1–10)', () => {
  it('« 1 » est ambigu vers 10 ; 2–9 et 10 ne le sont pas', () => {
    expect(isAmbiguousIntegerPrefix('1', 1, 10)).toBe(true)
    expect(isAmbiguousIntegerPrefix('2', 1, 10)).toBe(false)
    expect(isAmbiguousIntegerPrefix('9', 1, 10)).toBe(false)
    expect(isAmbiguousIntegerPrefix('10', 1, 10)).toBe(false)
    expect(isAmbiguousIntegerPrefix('1.0', 1, 10)).toBe(false)
  })
})

describe('shouldAppendNextSetOnRestSkip', () => {
  it('n’append pas si une série suivante !done existe déjà', () => {
    expect(
      shouldAppendNextSetOnRestSkip([{ done: true }, { done: false }, { done: false }], 0),
    ).toBe(false)
  })

  it('append seulement s’il n’existe pas de série suivante !done', () => {
    expect(shouldAppendNextSetOnRestSkip([{ done: true }], 0)).toBe(true)
    expect(shouldAppendNextSetOnRestSkip([{ done: true }, { done: true }], 0)).toBe(true)
  })
})

describe('isSetReadyForAutoValidate', () => {
  it('refuse sans Effort / charge / reps invalides', () => {
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: 20 })).toBe(false)
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: 20, rpe: undefined })).toBe(false)
    expect(isSetReadyForAutoValidate({ reps: 0, weightKg: 20, rpe: 8 })).toBe(false)
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: Number.NaN, rpe: 8 })).toBe(false)
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: 20, rpe: 8, done: true })).toBe(false)
  })

  it('accepte charge+reps+Effort 1–10 (0 kg autorisé)', () => {
    expect(isSetReadyForAutoValidate({ reps: 8, weightKg: 20, rpe: 7 })).toBe(true)
    expect(isSetReadyForAutoValidate({ reps: 10, weightKg: 0, rpe: 1 })).toBe(true)
    expect(isSetReadyForAutoValidate({ reps: 6, weightKg: 80, rpe: 10 })).toBe(true)
  })
})

describe('shouldCommitAutoValidate', () => {
  const key = makeAutoValidateKey('ex-1', 0, { reps: 8, weightKg: 20, rpe: 8 })

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
