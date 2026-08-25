import { circularStdDevMinutes, parseTimeToMinutes } from './circularTime.ts'
import { MIN_REGULARITY_SAMPLES } from './validation.ts'
import type { SleepRegularityMetrics } from './types.ts'

/**
 * Variabilité circulaire des horaires.
 * Aucune étiquette « régulier / irrégulier » : pas de seuil clinique justifié fourni.
 */
export function computeRegularityMetrics(
  bedtime: string,
  waketime: string,
  historicalBedtimes: string[] = [],
  historicalWaketimes: string[] = [],
): SleepRegularityMetrics {
  const bedSamples = [bedtime, ...historicalBedtimes]
    .map(parseTimeToMinutes)
    .filter((m): m is number => m != null)

  const wakeSamples = [waketime, ...historicalWaketimes]
    .map(parseTimeToMinutes)
    .filter((m): m is number => m != null)

  const bedOk = bedSamples.length >= MIN_REGULARITY_SAMPLES
  const wakeOk = wakeSamples.length >= MIN_REGULARITY_SAMPLES
  const insufficientHistory = !bedOk && !wakeOk

  return {
    bedtimeVariabilityMinutes: bedOk ? circularStdDevMinutes(bedSamples) : null,
    waketimeVariabilityMinutes: wakeOk ? circularStdDevMinutes(wakeSamples) : null,
    insufficientHistory,
    sampleCountBedtime: bedSamples.length,
    sampleCountWaketime: wakeSamples.length,
  }
}
