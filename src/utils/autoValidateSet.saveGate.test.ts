import { describe, expect, it } from 'vitest'
import {
  validateTrainSetNumber,
  workoutSessionSaveError,
} from './autoValidateSet'

describe('validateTrainSetNumber (shared Valider / blur / Terminer)', () => {
  it('accepte les bornes inclusives et 0 kg', () => {
    expect(validateTrainSetNumber('weight', 0)).toBeNull()
    expect(validateTrainSetNumber('weight', 500)).toBeNull()
    expect(validateTrainSetNumber('reps', 1)).toBeNull()
    expect(validateTrainSetNumber('reps', 50)).toBeNull()
    expect(validateTrainSetNumber('effort', 10)).toBeNull()
  })

  it('refuse vide seulement comme non-erreur (saisie en cours)', () => {
    expect(validateTrainSetNumber('weight', null)).toBeNull()
    expect(validateTrainSetNumber('reps', undefined)).toBeNull()
  })

  it('refuse NaN, Infinity et hors bornes', () => {
    expect(validateTrainSetNumber('weight', Number.NaN)).toMatch(/invalide/i)
    expect(validateTrainSetNumber('weight', Number.POSITIVE_INFINITY)).toMatch(
      /invalide/i,
    )
    expect(validateTrainSetNumber('weight', 501)).toMatch(/hors limites/i)
    expect(validateTrainSetNumber('weight', -1)).toMatch(/hors limites/i)
    expect(validateTrainSetNumber('reps', 0)).toMatch(/hors limites/i)
    expect(validateTrainSetNumber('reps', 51)).toMatch(/hors limites/i)
    expect(validateTrainSetNumber('reps', Number.POSITIVE_INFINITY)).toMatch(
      /invalide/i,
    )
  })
})

describe('workoutSessionSaveError', () => {
  it('laisse passer une séance valide', () => {
    expect(
      workoutSessionSaveError([
        { sets: [{ weightKg: 20, reps: 8 }, { weightKg: 0, reps: 0 }] },
      ]),
    ).toBeNull()
  })

  it('bloque 501 kg / 51 reps / Infinity (Terminer)', () => {
    expect(
      workoutSessionSaveError([{ sets: [{ weightKg: 501, reps: 8 }] }]),
    ).toMatch(/hors limites/i)
    expect(
      workoutSessionSaveError([{ sets: [{ weightKg: 20, reps: 51 }] }]),
    ).toMatch(/hors limites/i)
    expect(
      workoutSessionSaveError([
        { sets: [{ weightKg: Number.POSITIVE_INFINITY, reps: 8 }] },
      ]),
    ).toMatch(/invalide/i)
  })
})
