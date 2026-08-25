import { computeCatchUp } from './catchUp'
import { computeTibHours } from './circularTime'
import { computeSleepEfficiency } from './efficiency'
import { classifyQuantity } from './quantity'
import { buildSleepRecommendations } from './recommendations'
import { computeRegularityMetrics } from './regularity'
import type { SleepEngineResult, SleepInput, SleepMetrics } from './types'
import { validateSleepInput } from './validation'

/**
 * Sleep Engine V1 — point d’entrée unique, pur et déterministe.
 * N’utilise ni wearables stages (REM/Deep/Light), ni nutrition, ni activité.
 * Ne modifie jamais le TIB automatiquement (restriction thérapeutique exclue).
 */
export function runSleepEngine(input: SleepInput): SleepEngineResult {
  const validationError = validateSleepInput(input)
  if (validationError) return validationError

  const derivedTibHours = computeTibHours(input.bedtime, input.waketime)
  const tibForEfficiency = input.currentTibHours ?? derivedTibHours

  const quantity = classifyQuantity(input.tstHours)
  const regularity = computeRegularityMetrics(
    input.bedtime,
    input.waketime,
    input.historicalBedtimes,
    input.historicalWaketimes,
  )
  const efficiency = computeSleepEfficiency(input.tstHours, tibForEfficiency)
  const catchUp = computeCatchUp(input.workdayTstHours)

  const metrics: SleepMetrics = {
    quantity,
    regularity,
    efficiency,
    catchUp,
    derivedTibHours,
  }

  const { recommendations, warnings } = buildSleepRecommendations(metrics)

  return {
    ok: true,
    status: quantity.scientific_status,
    metrics,
    recommendations,
    warnings,
  }
}

/** Sérialisation API — arrondis d’affichage uniquement. */
export function formatSleepApiPayload(result: SleepEngineResult) {
  const round1 = (n: number) => Math.round(n * 10) / 10
  const round2 = (n: number) => Math.round(n * 100) / 100

  if (!result.ok) {
    return {
      status: 'ERROR' as const,
      error_code: result.code,
      message: result.message,
      details: result.details ?? {},
      recommendations: [] as string[],
      warnings: [] as string[],
    }
  }

  const { metrics } = result
  return {
    status: 'SUCCESS' as const,
    scientific_status: result.status,
    metrics: {
      quantity: {
        scientific_status: metrics.quantity.scientific_status,
        tstHours: round2(metrics.quantity.tstHours),
      },
      regularity: {
        bedtimeVariabilityMinutes:
          metrics.regularity.bedtimeVariabilityMinutes == null
            ? null
            : round1(metrics.regularity.bedtimeVariabilityMinutes),
        waketimeVariabilityMinutes:
          metrics.regularity.waketimeVariabilityMinutes == null
            ? null
            : round1(metrics.regularity.waketimeVariabilityMinutes),
        insufficientHistory: metrics.regularity.insufficientHistory,
        sampleCountBedtime: metrics.regularity.sampleCountBedtime,
        sampleCountWaketime: metrics.regularity.sampleCountWaketime,
      },
      efficiency: {
        sleepEfficiencyPercent:
          metrics.efficiency.sleepEfficiencyPercent == null
            ? null
            : round1(metrics.efficiency.sleepEfficiencyPercent),
        aboveClinicalTibRestrictionThreshold85:
          metrics.efficiency.aboveClinicalTibRestrictionThreshold85,
      },
      catchUp: {
        recoveryNeeded: metrics.catchUp.recoveryNeeded,
        workdayAverageTstHours:
          metrics.catchUp.workdayAverageTstHours == null
            ? null
            : round2(metrics.catchUp.workdayAverageTstHours),
        recommendation: metrics.catchUp.recommendation ?? null,
      },
      derivedTibHours:
        metrics.derivedTibHours == null ? null : round2(metrics.derivedTibHours),
    },
    recommendations: result.recommendations,
    warnings: result.warnings,
  }
}

export function runSleepEngineApi(input: SleepInput) {
  const result = runSleepEngine(input)
  return {
    status: result.ok ? 200 : result.httpStatus,
    body: formatSleepApiPayload(result),
  }
}
