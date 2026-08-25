import type { SleepEngineFailure } from './types'

export const ERROR_CODES = {
  INVALID_BEDTIME: 'ERR_INVALID_BEDTIME',
  INVALID_WAKETIME: 'ERR_INVALID_WAKETIME',
  INVALID_TST: 'ERR_INVALID_TST',
  INVALID_TIB: 'ERR_INVALID_TIB',
  TST_EXCEEDS_TIB: 'ERR_TST_EXCEEDS_TIB',
  INVALID_HISTORY: 'ERR_INVALID_HISTORY',
  INVALID_BODY: 'ERR_INVALID_BODY',
  FORBIDDEN_FIELD: 'ERR_FORBIDDEN_FIELD',
} as const

export type SleepErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export function sleepError(
  code: SleepErrorCode,
  message: string,
  httpStatus = 400,
  details?: Record<string, unknown>,
): SleepEngineFailure {
  return { ok: false, httpStatus, code, message, details }
}
