import { PERFORMANCE_RATING_START } from './constants.ts'
import { freshnessEventsFromSets, muscleFreshness } from './freshness.ts'
import { preparationScore } from './preparation.ts'
import { latestKnownTst, sleepBankMinutes } from './sleepBank.ts'
import {
  strainBand,
  strainScale,
  strainZScore,
  sumStrainUnits,
  targetStrainBand,
  workoutStrainScore,
} from './strain.ts'
import type { BuildProgressionInput, ProgressionDay } from './types.ts'
import { nextPerformanceRating, sessionXp } from './xp.ts'

export function buildProgressionDay(input: BuildProgressionInput): ProgressionDay {
  const bodyweight = input.bodyweightKg
  const rawStrainUnits = sumStrainUnits(input.sets, bodyweight)
  const scale = strainScale(input.medianStrainRaw28)
  const hasSets = input.sets.some((set) => set.done !== false && set.reps > 0)
  const workoutStrain = hasSets ? workoutStrainScore(rawStrainUnits, input.medianStrainRaw28) : null
  const bank = sleepBankMinutes(input.tstHoursLast7, input.sleepGoalMinutes)
  const todayTst = latestKnownTst(input.tstHoursLast7)
  const preparation = preparationScore({
    tstHoursToday: todayTst,
    sleepBankMinutes: bank,
    regularitySigmaMinutes: input.regularitySigmaMinutes,
    yesterdayStrainZ: input.yesterdayStrainZ,
  })
  const z = workoutStrain == null ? null : strainZScore(workoutStrain, input.baseline)
  const band = strainBand(z)
  const target = targetStrainBand(input.baseline, preparation.score)
  const awarded = sessionXp({
    sets: input.sets,
    workoutStrain,
    strainBand: band,
    preparation: preparation.score,
    sleepBankMinutes: bank,
    hadPr: input.hadPr,
  })
  const rating = nextPerformanceRating({
    rating: input.performanceRating ?? PERFORMANCE_RATING_START,
    ratedSessions: input.ratedSessions ?? 0,
    strainZ: z,
  })
  const freshness = muscleFreshness(freshnessEventsFromSets(input.sets, bodyweight, 0))
  return {
    rawStrainUnits,
    strainScale: scale,
    workoutStrain,
    strainZ: z,
    strainBand: band,
    targetLow: target?.low ?? null,
    targetHigh: target?.high ?? null,
    sleepBankMinutes: bank,
    preparation: preparation.score,
    preparationPartial: preparation.partial,
    muscleFreshness: freshness,
    xp: awarded.xp,
    strainXp: awarded.strainXp,
    xpMultiplier: awarded.multiplier,
    performanceRating: rating,
    ratedSessions: (input.ratedSessions ?? 0) + (hasSets ? 1 : 0),
  }
}
