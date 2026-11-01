import type { LoadMode } from './types.ts'

/**
 * Charge nette utilisée par Epley.
 * Machine classique : poids affiché, jamais le poids du corps (une charge
 * inférieure au corps resterait négative si on soustrayait).
 * Assistée uniquement : poids du corps − poids d’aide, plancher 0.
 */
export function effectiveLoadKg(input: {
  loadMode: LoadMode
  loggedKg: number
  bodyweightKg?: number | null
}): number | null {
  if (!Number.isFinite(input.loggedKg) || input.loggedKg < 0) return null
  if (input.loadMode === 'assisted_bodyweight') {
    const body = input.bodyweightKg
    if (body == null || !Number.isFinite(body) || body < 0) return null
    return Math.max(0, body - input.loggedKg)
  }
  if (input.loadMode === 'bodyweight') return 0
  return input.loggedKg
}
