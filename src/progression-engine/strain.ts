import {
  BODYWEIGHT_REFERENCE_KG,
  RPE_FACTOR_MAX,
  RPE_FACTOR_MIN,
  RPE_FACTOR_PER_POINT,
  RPE_NEUTRAL,
  STRAIN_SCALE_FALLBACK,
  STRAIN_Z_MIN_DAYS,
  STRAIN_Z_SD_FLOOR,
  STRAIN_Z_WITHIN,
} from './constants.ts'
import { effectiveLoadKg } from './load.ts'
import type { LoadMode, StrainBand, StrainBaseline, StrengthSetInput } from './types.ts'

export function rpeFactor(rpe: number | null | undefined): number {
  if (rpe == null || !Number.isFinite(rpe)) return 1
  const clamped = Math.min(10, Math.max(1, rpe))
  const factor = 1 + (clamped - RPE_NEUTRAL) * RPE_FACTOR_PER_POINT
  return Math.min(RPE_FACTOR_MAX, Math.max(RPE_FACTOR_MIN, factor))
}

export function epley1Rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30)
}

export function isDoneSet(set: StrengthSetInput): boolean {
  return set.done !== false
}

export function setStrainUnits(
  set: StrengthSetInput,
  bodyweightKg: number | null | undefined,
): number | null {
  if (!Number.isFinite(set.reps) || set.reps <= 0) return null
  const mode: LoadMode = set.loadMode ?? 'external'
  const factor = rpeFactor(set.rpe)
  if (mode === 'bodyweight') {
    const body = bodyweightKg
    const bwFactor = body != null && Number.isFinite(body) && body > 0 ? body / BODYWEIGHT_REFERENCE_KG : 1
    return set.reps * factor * bwFactor
  }
  const load = effectiveLoadKg({ loadMode: mode, loggedKg: set.loggedKg, bodyweightKg })
  if (load == null) return null
  if (load === 0) return 0
  return epley1Rm(load, set.reps) * factor * (set.reps / 30)
}

export function sumStrainUnits(
  sets: StrengthSetInput[],
  bodyweightKg: number | null | undefined,
): number {
  let total = 0
  for (const set of sets) {
    if (!isDoneSet(set)) continue
    const units = setStrainUnits(set, bodyweightKg)
    if (units != null && Number.isFinite(units)) total += units
  }
  return total
}

export function strainScale(medianStrainRaw28: number | null): number {
  if (medianStrainRaw28 != null && Number.isFinite(medianStrainRaw28) && medianStrainRaw28 > 0) {
    return medianStrainRaw28
  }
  return STRAIN_SCALE_FALLBACK
}

/** Strain 0–100. Échelle = médiane, ou 150 si elle est null (cold start). */
export function workoutStrainScore(rawUnits: number, medianStrainRaw28: number | null): number {
  const raw = Number.isFinite(rawUnits) && rawUnits > 0 ? rawUnits : 0
  const scale = strainScale(medianStrainRaw28)
  const continuous = 100 * (1 - Math.exp(-raw / scale))
  return Math.round(continuous)
}

export function strainZScore(
  workoutStrain: number,
  baseline: StrainBaseline | null | undefined,
): number | null {
  if (!baseline) return null
  if (!Number.isFinite(baseline.sampleCount) || baseline.sampleCount < STRAIN_Z_MIN_DAYS) return null
  if (!Number.isFinite(baseline.mean) || !Number.isFinite(baseline.sd)) return null
  const sd = Math.max(baseline.sd, STRAIN_Z_SD_FLOOR)
  return (workoutStrain - baseline.mean) / sd
}

export function strainBand(z: number | null): StrainBand | null {
  if (z == null || !Number.isFinite(z)) return null
  if (z < -STRAIN_Z_WITHIN) return 'below'
  if (z > STRAIN_Z_WITHIN) return 'above'
  return 'within'
}

export function targetStrainBand(
  baseline: StrainBaseline | null | undefined,
  preparation: number | null,
): { low: number; high: number } | null {
  if (!baseline) return null
  if (!Number.isFinite(baseline.sampleCount) || baseline.sampleCount < STRAIN_Z_MIN_DAYS) return null
  if (!Number.isFinite(baseline.mean) || !Number.isFinite(baseline.sd)) return null
  const readiness = preparation == null || !Number.isFinite(preparation) ? 50 : preparation
  const factor = Math.min(1.15, Math.max(0.55, 0.55 + 0.5 * (readiness / 100)))
  const center = baseline.mean * factor
  const sd = Math.max(baseline.sd, STRAIN_Z_SD_FLOOR)
  return { low: center - 0.5 * sd, high: center + 0.5 * sd }
}
