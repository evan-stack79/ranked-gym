import type { NutritionEngineFailure } from './types'

export const ERROR_CODES = {
  INVALID_AGE: 'ERR_INVALID_AGE',
  INVALID_WEIGHT: 'ERR_INVALID_WEIGHT',
  INVALID_HEIGHT: 'ERR_INVALID_HEIGHT',
  INVALID_ACTIVITY: 'ERR_INVALID_ACTIVITY',
  INVALID_DEFICIT: 'ERR_INVALID_DEFICIT',
  INVALID_SURPLUS: 'ERR_INVALID_SURPLUS',
  INVALID_DURATION: 'ERR_INVALID_DURATION',
  INVALID_FLUID_LOSS: 'ERR_INVALID_FLUID_LOSS',
  INVALID_SEX: 'ERR_INVALID_SEX',
  INVALID_GOAL: 'ERR_INVALID_GOAL',
  TARGET_BELOW_BCMR: 'ERR_TARGET_BELOW_BCMR',
  ENERGY_CONSERVATION: 'ERR_ENERGY_CONSERVATION',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export function engineError(
  code: ErrorCode,
  message: string,
  httpStatus = 400,
  details?: Record<string, unknown>,
): NutritionEngineFailure {
  return { ok: false, httpStatus, code, message, details }
}
