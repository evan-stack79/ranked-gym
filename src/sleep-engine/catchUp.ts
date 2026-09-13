import type { CatchUpSleepResult } from './types.ts'

/**
 * Catch-up sleep — recommandation informative uniquement.
 * Ne prescrit pas médicalement « +1 h à +2 h ».
 * Encourage la récupération tout en préservant la régularité des horaires.
 */
export function computeCatchUp(workdayTstHours?: number[]): CatchUpSleepResult {
  if (!workdayTstHours || workdayTstHours.length === 0) {
    return {
      recoveryNeeded: false,
      workdayAverageTstHours: null,
    }
  }

  const sum = workdayTstHours.reduce((a, b) => a + b, 0)
  const workdayAverageTstHours = sum / workdayTstHours.length

  if (workdayAverageTstHours >= 7) {
    return {
      recoveryNeeded: false,
      workdayAverageTstHours,
    }
  }

  return {
    recoveryNeeded: true,
    workdayAverageTstHours,
    recommendation:
      'En moyenne, tu dors moins de 7 h les jours travaillés. ' +
      'Le week-end, tu peux récupérer un peu en te couchant un peu plus tôt, ' +
      'plutôt qu’en te levant beaucoup plus tard — pour garder un rythme stable. ' +
      'C’est une piste informative, pas un conseil médical.',
  }
}
