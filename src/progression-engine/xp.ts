import {
  ELO_ESTABLISHED_SESSIONS,
  ELO_K_ESTABLISHED,
  ELO_K_NEW,
  PERFORMANCE_RATING_CAP,
  PERFORMANCE_RATING_FLOOR,
  PERFORMANCE_RATING_START,
  PREPARATION_WITHIN_TARGET_MIN,
  PREPARATION_WITHIN_TARGET_MULTIPLIER,
  SLEEP_DEBT_XP_MULTIPLIER,
  SLEEP_DEBT_XP_THRESHOLD_MIN,
  XP_BASE,
  XP_PER_DONE_SET,
  XP_PER_LEVEL,
  XP_QUALITY_LOADS,
  XP_QUALITY_PR,
  XP_QUALITY_RPE,
  XP_SESSION_CAP,
  XP_SET_BONUS_CAP,
  XP_STRAIN_FACTOR,
} from './constants.ts'
import type { StrainBand, StrengthSetInput } from './types.ts'
import { isDoneSet } from './strain.ts'

export function applyXpToLevel(
  level: number,
  xp: number,
  gain: number,
): { level: number; xp: number } {
  let nextLevel = Math.max(1, Number.isFinite(level) ? Math.floor(level) : 1)
  let nextXp = Math.max(0, Number.isFinite(xp) ? xp : 0) + Math.max(0, gain)
  while (nextXp >= XP_PER_LEVEL) {
    nextXp -= XP_PER_LEVEL
    nextLevel += 1
  }
  return { level: nextLevel, xp: nextXp }
}

function loadsLogged(set: StrengthSetInput): boolean {
  const mode = set.loadMode ?? 'external'
  if (mode === 'bodyweight') return true
  return Number.isFinite(set.loggedKg) && set.loggedKg > 0
}

export function sessionXp(input: {
  sets: StrengthSetInput[]
  workoutStrain: number | null
  strainBand: StrainBand | null
  preparation: number | null
  sleepBankMinutes: number | null
  hadPr?: boolean
}): { xp: number; strainXp: number; multiplier: number } {
  const done = input.sets.filter(isDoneSet)
  const base = XP_BASE + Math.min(XP_SET_BONUS_CAP, done.length * XP_PER_DONE_SET)
  const strainXp =
    input.workoutStrain == null || !Number.isFinite(input.workoutStrain)
      ? 0
      : Math.round(input.workoutStrain * XP_STRAIN_FACTOR)
  let quality = 0
  if (done.length > 0 && done.every(loadsLogged)) quality += XP_QUALITY_LOADS
  const withRpe = done.filter((set) => set.rpe != null && Number.isFinite(set.rpe)).length
  if (done.length > 0 && withRpe * 2 >= done.length) quality += XP_QUALITY_RPE
  if (input.hadPr) quality += XP_QUALITY_PR

  let multiplier = 1
  if (
    input.preparation != null &&
    input.preparation >= PREPARATION_WITHIN_TARGET_MIN &&
    input.strainBand === 'within'
  ) {
    multiplier *= PREPARATION_WITHIN_TARGET_MULTIPLIER
  }
  if (
    input.sleepBankMinutes != null &&
    input.sleepBankMinutes < SLEEP_DEBT_XP_THRESHOLD_MIN
  ) {
    multiplier *= SLEEP_DEBT_XP_MULTIPLIER
  }
  const xp = Math.min(XP_SESSION_CAP, Math.max(0, Math.round((base + strainXp + quality) * multiplier)))
  return { xp, strainXp, multiplier }
}

/** Elo interne. z null → rating inchangé. Plancher 800, plafond 4000. */
export function nextPerformanceRating(input: {
  rating?: number
  ratedSessions?: number
  strainZ: number | null
}): number {
  const rating = Number.isFinite(input.rating) ? (input.rating as number) : PERFORMANCE_RATING_START
  if (input.strainZ == null || !Number.isFinite(input.strainZ)) {
    return Math.round(Math.min(PERFORMANCE_RATING_CAP, Math.max(PERFORMANCE_RATING_FLOOR, rating)))
  }
  const performance01 = Math.min(1, Math.max(0, (input.strainZ + 2) / 4))
  const sessions = Number.isFinite(input.ratedSessions) ? (input.ratedSessions as number) : 0
  const k = sessions < ELO_ESTABLISHED_SESSIONS ? ELO_K_NEW : ELO_K_ESTABLISHED
  const next = rating + k * (performance01 - 0.5) * 2
  return Math.round(Math.min(PERFORMANCE_RATING_CAP, Math.max(PERFORMANCE_RATING_FLOOR, next)))
}
