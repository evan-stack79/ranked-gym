import { SLEEP_BANK_DEFAULT_GOAL_MINUTES, SLEEP_BANK_MIN_NIGHTS } from './constants.ts'

/**
 * Banque = somme (TST − objectif) sur les nuits dont le TST est connu.
 * Moins de 3 nuits connues → null. Un TST null n’est pas un zéro.
 */
export function sleepBankMinutes(
  tstHoursLast7: Array<number | null>,
  goalMinutes: number = SLEEP_BANK_DEFAULT_GOAL_MINUTES,
): number | null {
  if (!Number.isFinite(goalMinutes)) return null
  const deltas: number[] = []
  for (const tst of tstHoursLast7) {
    if (tst == null || !Number.isFinite(tst) || tst < 0) continue
    deltas.push(tst * 60 - goalMinutes)
  }
  if (deltas.length < SLEEP_BANK_MIN_NIGHTS) return null
  return deltas.reduce((sum, delta) => sum + delta, 0)
}

export function latestKnownTst(tstHoursLast7: Array<number | null>): number | null {
  for (let i = tstHoursLast7.length - 1; i >= 0; i -= 1) {
    const tst = tstHoursLast7[i]
    if (tst != null && Number.isFinite(tst) && tst >= 0) return tst
  }
  return null
}
