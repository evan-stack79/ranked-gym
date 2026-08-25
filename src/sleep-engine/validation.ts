import { ERROR_CODES, sleepError } from './errors.ts'
import { computeTibHours, parseTimeToMinutes } from './circularTime.ts'
import type { SleepEngineFailure, SleepInput } from './types.ts'

/** Minimum d’échantillons pour une dispersion circulaire informative (choix ingénierie, pas seuil clinique). */
export const MIN_REGULARITY_SAMPLES = 3

export function validateSleepInput(input: SleepInput): SleepEngineFailure | null {
  if (typeof input.bedtime !== 'string' || parseTimeToMinutes(input.bedtime) == null) {
    return sleepError(ERROR_CODES.INVALID_BEDTIME, 'bedtime invalide (ISO datetime ou HH:MM attendu)', 400, {
      bedtime: input.bedtime,
    })
  }

  if (typeof input.waketime !== 'string' || parseTimeToMinutes(input.waketime) == null) {
    return sleepError(ERROR_CODES.INVALID_WAKETIME, 'waketime invalide (ISO datetime ou HH:MM attendu)', 400, {
      waketime: input.waketime,
    })
  }

  if (!Number.isFinite(input.tstHours) || input.tstHours < 0) {
    return sleepError(ERROR_CODES.INVALID_TST, 'tstHours doit être un nombre ≥ 0', 400, {
      tstHours: input.tstHours,
    })
  }

  if (input.tstHours > 24) {
    return sleepError(ERROR_CODES.INVALID_TST, 'tstHours ne peut pas dépasser 24 h', 400, {
      tstHours: input.tstHours,
    })
  }

  if (input.currentTibHours != null) {
    if (!Number.isFinite(input.currentTibHours) || input.currentTibHours <= 0) {
      return sleepError(ERROR_CODES.INVALID_TIB, 'currentTibHours doit être un nombre > 0', 400, {
        currentTibHours: input.currentTibHours,
      })
    }
    if (input.tstHours > input.currentTibHours) {
      return sleepError(
        ERROR_CODES.TST_EXCEEDS_TIB,
        'TST ne peut pas dépasser TIB (tstHours > currentTibHours)',
        400,
        { tstHours: input.tstHours, currentTibHours: input.currentTibHours },
      )
    }
  }

  const derivedTib = computeTibHours(input.bedtime, input.waketime)
  if (derivedTib != null && input.tstHours > derivedTib + 1e-9) {
    return sleepError(
      ERROR_CODES.TST_EXCEEDS_TIB,
      'TST ne peut pas dépasser TIB dérivé de bedtime→waketime',
      400,
      { tstHours: input.tstHours, derivedTibHours: derivedTib },
    )
  }

  if (input.historicalBedtimes) {
    for (const t of input.historicalBedtimes) {
      if (typeof t !== 'string' || parseTimeToMinutes(t) == null) {
        return sleepError(ERROR_CODES.INVALID_HISTORY, 'historicalBedtimes contient une heure invalide', 400, {
          value: t,
        })
      }
    }
  }

  if (input.historicalWaketimes) {
    for (const t of input.historicalWaketimes) {
      if (typeof t !== 'string' || parseTimeToMinutes(t) == null) {
        return sleepError(ERROR_CODES.INVALID_HISTORY, 'historicalWaketimes contient une heure invalide', 400, {
          value: t,
        })
      }
    }
  }

  if (input.workdayTstHours) {
    for (const h of input.workdayTstHours) {
      if (!Number.isFinite(h) || h < 0) {
        return sleepError(ERROR_CODES.INVALID_HISTORY, 'workdayTstHours contient une valeur invalide', 400, {
          value: h,
        })
      }
    }
  }

  return null
}

/** Champs d’activité / nutrition / wearables stages — ignorés ou rejetés s’ils tentent d’influencer le moteur. */
export function validateForbiddenFields(raw: Record<string, unknown>): SleepEngineFailure | null {
  const forbidden = [
    'burned_calories',
    'activityBonus',
    'steps_calories',
    'workout_calories',
    'active_calories',
    'steps',
    'workout',
  ] as const

  for (const key of forbidden) {
    if (key in raw && raw[key] != null && raw[key] !== 0 && raw[key] !== '') {
      return sleepError(
        ERROR_CODES.FORBIDDEN_FIELD,
        `Le champ "${key}" est interdit — il ne doit pas influencer le Sleep Engine.`,
        400,
        { field: key },
      )
    }
  }

  return null
}
