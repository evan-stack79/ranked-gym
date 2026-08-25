import type { SleepEfficiencyResult } from './types.ts'

/**
 * Efficacité du sommeil SE = TST / TIB × 100.
 *
 * Le seuil 85 % est documenté comme issu du contexte clinique de la
 * restriction du temps au lit (TIB restriction) — ce n’est PAS une définition
 * universelle de « bonne qualité du sommeil ».
 */
export const CLINICAL_TIB_RESTRICTION_SE_THRESHOLD = 85

export function computeSleepEfficiency(
  tstHours: number,
  tibHours: number | null | undefined,
): SleepEfficiencyResult {
  if (tibHours == null || !Number.isFinite(tibHours) || tibHours <= 0) {
    return {
      sleepEfficiencyPercent: null,
      aboveClinicalTibRestrictionThreshold85: null,
    }
  }

  const sleepEfficiencyPercent = (tstHours / tibHours) * 100
  return {
    sleepEfficiencyPercent,
    aboveClinicalTibRestrictionThreshold85:
      sleepEfficiencyPercent >= CLINICAL_TIB_RESTRICTION_SE_THRESHOLD,
  }
}
