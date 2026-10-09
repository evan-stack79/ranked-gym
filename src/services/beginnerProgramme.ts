/**
 * Programme Débutant — éligibilité, construction de routine, swaps machine.
 * Swap = autre canonicalExerciseId → historique de charge jamais mélangé.
 */

import {
  BEGINNER_EXERCISES,
  BEGINNER_PROGRAMME_ID,
  BEGINNER_PROGRAMME_SUBTITLE,
  BEGINNER_PROGRAMME_TITLE,
  BEGINNER_REST_BIG_SEC,
  BEGINNER_REST_SMALL_SEC,
  BEGINNER_SETS_START,
  BEGINNER_TARGET_REPS_MAX,
  BEGINNER_TARGET_REPS_MIN,
  GAINAGE_HOLD_TEXT,
  type BeginnerExerciseSlot,
} from '../data/beginnerProgramme'
import { MINOR_AGE_THRESHOLD } from './nutritionSafetyRules'
import type { ExerciseEntry, WorkoutRoutine } from '../types/training'
import type { CalorieProfile } from '../types/nutrition'

export { GAINAGE_HOLD_TEXT, BEGINNER_PROGRAMME_ID }

export type BeginnerEligibility = {
  eligible: boolean
  reason: 'ok' | 'minor' | 'pregnancy' | 'breastfeeding' | 'unknown_age'
}

export function beginnerProgrammeEligibility(
  profile: Pick<
    CalorieProfile,
    'age' | 'declaredPregnancy' | 'declaredBreastfeeding' | 'healthAnswer'
  >,
): BeginnerEligibility {
  const age = typeof profile.age === 'number' && profile.age > 0 ? profile.age : null
  if (age == null) return { eligible: false, reason: 'unknown_age' }
  if (age < MINOR_AGE_THRESHOLD) return { eligible: false, reason: 'minor' }

  const situations = profile.healthAnswer === 'situations'
  const pregnant = situations && Boolean(profile.declaredPregnancy)
  const breastfeeding = situations && Boolean(profile.declaredBreastfeeding)
  // Legacy flags without healthAnswer still respected
  const pregnantLegacy = profile.healthAnswer == null && Boolean(profile.declaredPregnancy)
  const breastLegacy = profile.healthAnswer == null && Boolean(profile.declaredBreastfeeding)

  if (pregnant || pregnantLegacy) return { eligible: false, reason: 'pregnancy' }
  if (breastfeeding || breastLegacy) return { eligible: false, reason: 'breastfeeding' }
  return { eligible: true, reason: 'ok' }
}

export function restSecForSlot(slot: BeginnerExerciseSlot): number {
  return slot.size === 'big' ? BEGINNER_REST_BIG_SEC : BEGINNER_REST_SMALL_SEC
}

function emptySets(count: number): ExerciseEntry['sets'] {
  return Array.from({ length: count }, () => ({
    reps: BEGINNER_TARGET_REPS_MIN,
    weightKg: 0,
  }))
}

/** Construit une entrée machine (ou gainage) — sets vides prêts à saisir. */
export function buildBeginnerExerciseEntry(
  slot: BeginnerExerciseSlot,
  opts?: { machineBusy?: boolean; setCount?: number },
): ExerciseEntry | null {
  const machineBusy = Boolean(opts?.machineBusy)
  const setCount = Math.max(
    1,
    Math.min(3, opts?.setCount ?? BEGINNER_SETS_START),
  )

  if (slot.kind === 'gainage') {
    return {
      id: `beg-${slot.catalogId}`,
      name: slot.name,
      canonicalExerciseId: slot.catalogId,
      sets: [],
      note: GAINAGE_HOLD_TEXT,
      targetRestSec: restSecForSlot(slot),
    }
  }

  if (machineBusy) {
    if (!slot.machineBusySwapId || !slot.machineBusySwapName) {
      // Leg curl : pas de swap → on saute
      return null
    }
    return {
      id: `beg-${slot.machineBusySwapId}`,
      name: slot.machineBusySwapName,
      canonicalExerciseId: slot.machineBusySwapId,
      sets: emptySets(setCount),
      targetRestSec: restSecForSlot(slot),
    }
  }

  return {
    id: `beg-${slot.catalogId}`,
    name: slot.name,
    canonicalExerciseId: slot.catalogId,
    sets: emptySets(setCount),
    targetRestSec: restSecForSlot(slot),
  }
}

export function buildBeginnerRoutineExercises(opts?: {
  machineBusyIds?: ReadonlySet<string> | string[]
  setCount?: number
}): ExerciseEntry[] {
  const busy = new Set(opts?.machineBusyIds ?? [])
  const out: ExerciseEntry[] = []
  for (const slot of BEGINNER_EXERCISES) {
    const entry = buildBeginnerExerciseEntry(slot, {
      machineBusy: busy.has(slot.catalogId),
      setCount: opts?.setCount,
    })
    if (entry) out.push(entry)
  }
  return out
}

export function buildBeginnerRoutine(now = Date.now()): WorkoutRoutine {
  return {
    id: BEGINNER_PROGRAMME_ID,
    label: BEGINNER_PROGRAMME_TITLE,
    subtitle: BEGINNER_PROGRAMME_SUBTITLE,
    accent: '#FF2B2B',
    exercises: buildBeginnerRoutineExercises(),
    updatedAt: now,
  }
}

/** Swap et machine sont des ids distincts — jamais fusionnés pour l’historique. */
export function areLoadHistoriesIsolated(
  machineCatalogId: string,
  swapCatalogId: string,
): boolean {
  return machineCatalogId !== swapCatalogId && Boolean(machineCatalogId) && Boolean(swapCatalogId)
}

export function beginnerRepRangeLabel(): string {
  return `${BEGINNER_TARGET_REPS_MIN}–${BEGINNER_TARGET_REPS_MAX}`
}

export function isGainageExercise(canonicalExerciseId: string | undefined | null): boolean {
  return canonicalExerciseId === 'forearm_plank'
}
