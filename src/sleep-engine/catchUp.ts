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
      'Votre moyenne de sommeil en jours travaillés est inférieure à 7 h. ' +
      'Envisagez une récupération progressive le week-end en avançant légèrement le coucher ' +
      'plutôt qu’en retardant fortement le lever, afin de préserver la régularité circadienne. ' +
      'Ceci est une suggestion informative, pas une prescription médicale.',
  }
}
