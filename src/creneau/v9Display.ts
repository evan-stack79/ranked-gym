/**
 * Mon créneau v9 — display helpers (never-past departure, state labels).
 */

import { formatHm, parseHm } from './engine'

export const CRENEAU_V9_BG = '#1d1f20'
export const CRENEAU_V9_RED = '#ff0702'

export type CreneauV9StateId =
  | 'autre_heure'
  | 'changer_salle'
  | 'le_soir'
  | 'pas_energie'
  | 'depart_depasse'
  | 'principal'
  | 'mineur'

/** True when clock HM is strictly after target HM (same local day). */
export function isHmPast(targetHm: string, nowHm: string): boolean {
  const t = parseHm(targetHm)
  const n = parseHm(nowHm)
  if (t == null || n == null) return false
  return n > t
}

/**
 * Next departure that is still in the future.
 * Maquette 05 : 17:15 passé → 17:30 (+15), puis +15 tant que ≤ now.
 */
export function nextFutureDeparture(
  baseHm: string,
  nowHm: string,
  stepMin = 15,
): string {
  const base = parseHm(baseHm)
  const now = parseHm(nowHm)
  if (base == null || now == null) return baseHm
  let candidate = base + stepMin
  // If base itself is still future, callers shouldn't need this — but if asked,
  // advance from base until strictly after now.
  if (base > now) return formatHm(base)
  while (candidate <= now) candidate += stepMin
  // Cap within the day for display; absolute safety stays in the engine.
  if (candidate >= 24 * 60) candidate = now + stepMin
  return formatHm(candidate)
}

export type DepartureDisplay = {
  /** True → show état 05. */
  departed: boolean
  /** Giant time to show (never in the past). */
  displayHm: string
  /** Original departure that was missed (état 05 headline). */
  passedHm: string | null
}

/**
 * Resolve what time to show on the principal / mineur / autre-heure screens.
 * The displayed hour is never in the past.
 */
export function resolveDepartureDisplay(
  departureHm: string,
  nowHm: string,
): DepartureDisplay {
  if (!isHmPast(departureHm, nowHm)) {
    return { departed: false, displayHm: departureHm, passedHm: null }
  }
  return {
    departed: true,
    displayHm: nextFutureDeparture(departureHm, nowHm),
    passedHm: departureHm,
  }
}

export function formatDepartedHeadline(passedHm: string): string {
  return `${passedHm} est passé. Nouvelle heure :`
}

export function salleTravelLine(gymName: string, travelLabel: string): string {
  return `${gymName} · ${travelLabel}`
}
