import type { SleepQuantityResult, SleepQuantityStatus } from './types'

/**
 * Classification quantité (adultes — fourchette usuelle 7–9 h).
 * Bornes inclusives : 7 h et 9 h = Optimal.
 * Ce n’est PAS un score clinique 0–100.
 */
export function classifyQuantity(tstHours: number): SleepQuantityResult {
  let scientific_status: SleepQuantityStatus
  if (tstHours >= 7 && tstHours <= 9) {
    scientific_status = 'optimal'
  } else if (tstHours < 7) {
    scientific_status = 'deficit'
  } else {
    scientific_status = 'excess'
  }
  return { scientific_status, tstHours }
}
