/**
 * Motion tokens for « Mon objectif de la semaine » — self-contained in the goal card.
 * WCAG 2.2 SC 2.3.1 : jamais plus de 3 flashs / seconde.
 */

/** Remplissage de barre (scaleX) — ≤ 400 ms, ease-out. */
export const WEEKLY_GOAL_FILL_MS = 360 as const

/**
 * Durée totale de l’étincelle 100 % (une seule itération).
 * Un seul pic de luminosité sur cette fenêtre ⇒ < 3 flashs/s.
 */
export const WEEKLY_GOAL_SPARK_MS = 650 as const

/** Nombre de flashs (pics de luminosité) dans une lecture de l’animation. */
export const WEEKLY_GOAL_SPARK_FLASH_COUNT = 1 as const

/** Plafond WCAG 2.2 SC 2.3.1. */
export const WCAG_MAX_FLASHES_PER_SECOND = 3 as const

/**
 * Flashs / seconde pour une animation de `durationMs` avec `flashCount` pics.
 * Doit rester ≤ WCAG_MAX_FLASHES_PER_SECOND.
 */
export function sparkFlashesPerSecond(
  durationMs: number = WEEKLY_GOAL_SPARK_MS,
  flashCount: number = WEEKLY_GOAL_SPARK_FLASH_COUNT,
): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return Number.POSITIVE_INFINITY
  if (!Number.isFinite(flashCount) || flashCount < 0) return Number.POSITIVE_INFINITY
  return flashCount / (durationMs / 1000)
}

export function isSparkWithinWcagFlashLimit(
  durationMs: number = WEEKLY_GOAL_SPARK_MS,
  flashCount: number = WEEKLY_GOAL_SPARK_FLASH_COUNT,
): boolean {
  return sparkFlashesPerSecond(durationMs, flashCount) <= WCAG_MAX_FLASHES_PER_SECOND
}
