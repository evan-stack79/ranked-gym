/** Capacité V1 d'une bouteille active (ml) — alignée sur WATER_BOTTLE_CAPACITY_ML. */
export const BOTTLE_CAPACITY_ML = 1500

export interface BottleProgress {
  completedCount: number
  activeMl: number
  activeProgress: number
  goalReached: boolean
  overGoalMl: number
  showActiveBottle: boolean
}

function sanitizeMl(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

function sanitizeCapacity(value: number): number {
  const cap = sanitizeMl(value)
  return cap > 0 ? cap : BOTTLE_CAPACITY_ML
}

/**
 * Dérive l'état visuel des bouteilles depuis le journal réel.
 * Mode automatique : uniquement consumedMl + objectif.
 * Mode calibré : voir `resolveBottleVisual`.
 */
export function deriveBottleProgress(
  consumedMl: number,
  goalMl: number,
  capacityMl: number = BOTTLE_CAPACITY_ML,
): BottleProgress {
  const consumed = sanitizeMl(consumedMl)
  const goal = sanitizeMl(goalMl)
  const capacity = sanitizeCapacity(capacityMl)

  const completedCount = Math.floor(consumed / capacity)
  const activeMl = consumed % capacity
  const activeProgress = capacity > 0 ? activeMl / capacity : 0
  const goalReached = goal > 0 && consumed >= goal
  const overGoalMl = goal > 0 ? Math.max(0, consumed - goal) : 0
  const showActiveBottle = !goalReached || activeMl > 0

  return {
    completedCount,
    activeMl,
    activeProgress,
    goalReached,
    overGoalMl,
    showActiveBottle,
  }
}

/**
 * Snapshot de calibrage (stockage technique).
 *
 * Vocabulaire :
 * - `remainingMl` (UI) = liquide physiquement restant dans la bouteille.
 * - `levelMl` / `waterBottleLevelMl` = ml déjà bus sur la bouteille active
 *   (= capacity − remainingMl). Champ legacy réutilisé.
 * - `calibrationTotalMl` / `waterBottleCalibrationTotalMl` = total du journal
 *   (`waterMl`) au moment du calibrage — ancre pour suivre les ajouts/retraits.
 */
export interface BottleCalibration {
  /** Phase technique : ml déjà bus sur la bouteille active (0–capacity). */
  levelMl: number
  /** Ancre journal : total consommé (ml) au moment du calibrage. */
  calibrationTotalMl: number
}

export interface BottleVisualOptions {
  capacityMl?: number
  /** Phase technique (ml bus sur bouteille active), pas les ml restants UI. */
  bottleLevelMl?: number
  /** Present ⇒ mode calibré ; ancre = waterMl au calibrage. */
  calibrationTotalMl?: number
}

const BOTTLE_STEP_ML = 10

function stepRound(ml: number): number {
  return Math.round(ml / BOTTLE_STEP_ML) * BOTTLE_STEP_ML
}

/** Normalise un volume restant dans la bouteille (0–capacity). */
export function clampBottleRemainingMl(
  ml: number,
  capacityMl: number = BOTTLE_CAPACITY_ML,
): number {
  const capacity = sanitizeCapacity(capacityMl)
  if (!Number.isFinite(ml)) return 0
  const stepped = stepRound(ml)
  return Math.min(capacity, Math.max(0, stepped))
}

/** Normalise un volume déjà bu sur la bouteille active (0–capacity). */
export function clampBottleConsumedOnBottleMl(
  ml: number,
  capacityMl: number = BOTTLE_CAPACITY_ML,
): number {
  return clampBottleRemainingMl(ml, capacityMl)
}

/**
 * UI → stockage : ml restants visibles → ml déjà bus sur la bouteille active.
 * Ex. remainingMl=1000, capacity=1500 → levelMl=500.
 */
export function remainingMlToConsumedOnBottle(
  remainingMl: number,
  capacityMl: number = BOTTLE_CAPACITY_ML,
): number {
  const capacity = sanitizeCapacity(capacityMl)
  const remaining = clampBottleRemainingMl(remainingMl, capacity)
  return capacity - remaining
}

/** Stockage → UI : ml déjà bus sur la bouteille active → ml restants visibles. */
export function consumedOnBottleToRemainingMl(
  consumedOnBottleMl: number,
  capacityMl: number = BOTTLE_CAPACITY_ML,
): number {
  const capacity = sanitizeCapacity(capacityMl)
  const consumed = clampBottleConsumedOnBottleMl(consumedOnBottleMl, capacity)
  return capacity - consumed
}

export function isBottleCalibrated(calibrationTotalMl: number | undefined): boolean {
  return typeof calibrationTotalMl === 'number' && Number.isFinite(calibrationTotalMl)
}

/**
 * Niveau visuel technique (`activeMl` = ml bus sur la bouteille active) en mode calibré.
 * Formule : (levelMl + (consumedMl − calibrationTotalMl)) mod capacity.
 * N’altère jamais le total journalier `waterMl` ni les entrées.
 */
export function deriveCalibratedActiveMl(
  consumedMl: number,
  calibration: BottleCalibration,
  capacityMl: number = BOTTLE_CAPACITY_ML,
): number {
  const capacity = sanitizeCapacity(capacityMl)
  const consumed = sanitizeMl(consumedMl)
  const baseTotal = sanitizeMl(calibration.calibrationTotalMl)
  const baseLevel = clampBottleConsumedOnBottleMl(calibration.levelMl, capacity)
  const delta = consumed - baseTotal
  const raw = baseLevel + delta
  return ((raw % capacity) + capacity) % capacity
}

/**
 * Résout l’affichage bouteille : automatique, calibré ou legacy (level seul).
 * Les miniatures (`completedCount`) restent toujours dérivées du total journalier réel.
 */
export function resolveBottleVisual(
  consumedMl: number,
  goalMl: number,
  options: BottleVisualOptions = {},
): BottleProgress {
  const capacity = sanitizeCapacity(options.capacityMl ?? BOTTLE_CAPACITY_ML)
  const base = deriveBottleProgress(consumedMl, goalMl, capacity)

  if (isBottleCalibrated(options.calibrationTotalMl)) {
    const activeMl = deriveCalibratedActiveMl(
      consumedMl,
      {
        levelMl: clampBottleConsumedOnBottleMl(options.bottleLevelMl ?? 0, capacity),
        calibrationTotalMl: options.calibrationTotalMl!,
      },
      capacity,
    )
    return {
      ...base,
      activeMl,
      activeProgress: capacity > 0 ? activeMl / capacity : 0,
    }
  }

  if (typeof options.bottleLevelMl === 'number' && Number.isFinite(options.bottleLevelMl)) {
    const legacyLevel = clampBottleConsumedOnBottleMl(options.bottleLevelMl, capacity)
    return {
      ...base,
      activeMl: legacyLevel,
      activeProgress: capacity > 0 ? legacyLevel / capacity : 0,
    }
  }

  return base
}
