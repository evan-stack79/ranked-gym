/**
 * Stats Accueil / écran Sommeil — info plainte, sans jugement ni score /100.
 */

import { circularStdDevMinutes, computeTibHours, parseTimeToMinutes } from '../sleep-engine'
import { formatDurationHoursLabel } from './sleepTimeFormat'

export interface SleepNightLike {
  bedtime: string
  waketime: string
  dateKey: string
}

/** Moyenne TIB sur les nuits fournies (fenêtre 7 nuits typique). */
export function averageTibHours(nights: SleepNightLike[]): number | null {
  if (nights.length === 0) return null
  const values: number[] = []
  for (const n of nights) {
    const tib = computeTibHours(n.bedtime, n.waketime)
    if (tib != null && tib > 0) values.push(tib)
  }
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function formatAverageTibLabel(nights: SleepNightLike[]): string | null {
  const avg = averageTibHours(nights)
  if (avg == null) return null
  return formatDurationHoursLabel(avg)
}

/**
 * Régularité du lever : σ circulaire en minutes.
 * null si < 2 échantillons valides (pas assez pour une dispersion).
 */
export function wakeRegularityStdMinutes(nights: SleepNightLike[]): number | null {
  const samples = nights
    .map((n) => parseTimeToMinutes(n.waketime))
    .filter((m): m is number => m != null)
  return circularStdDevMinutes(samples)
}

/** Libellé neutre : « Lever ± 25 min » — aucune étiquette irrégulier/bon. */
export function formatWakeRegularityLabel(nights: SleepNightLike[]): string | null {
  const std = wakeRegularityStdMinutes(nights)
  if (std == null) return null
  const rounded = Math.round(std)
  return `Lever ± ${rounded} min`
}
