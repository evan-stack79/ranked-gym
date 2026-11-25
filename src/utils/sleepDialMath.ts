/**
 * Math cadran sommeil — décalage à durée fixe (lune+soleil ensemble).
 */

import { computeTibHours } from '../sleep-engine'
import { hmToMinutes, minutesToHm, snapMinutes } from './sleepTimeFormat'

const DAY = 24 * 60

export function sleepSpanMinutes(bedtime: string, waketime: string): number | null {
  const bed = hmToMinutes(bedtime)
  const wake = hmToMinutes(waketime)
  if (bed == null || wake == null) return null
  let span = wake - bed
  if (span <= 0) span += DAY
  return span
}

/**
 * Décale coucher et lever du même delta (minutes), durée inchangée.
 * Snap 5 min. Refuse un décalage qui écraserait la durée (garde ≥ 5 min).
 */
export function shiftSleepWindow(
  bedtime: string,
  waketime: string,
  deltaMinutes: number,
): { bedtime: string; waketime: string } | null {
  const bed = hmToMinutes(bedtime)
  const wake = hmToMinutes(waketime)
  const span = sleepSpanMinutes(bedtime, waketime)
  if (bed == null || wake == null || span == null || span < 5) return null

  const nextBed = snapMinutes(bed + deltaMinutes, 5)
  const nextWake = snapMinutes(nextBed + span, 5)
  const next = {
    bedtime: minutesToHm(nextBed),
    waketime: minutesToHm(nextWake),
  }
  const nextSpan = sleepSpanMinutes(next.bedtime, next.waketime)
  if (nextSpan == null || Math.abs(nextSpan - span) > 1) {
    // Recalcule wake depuis bed+span exact
    return {
      bedtime: minutesToHm(nextBed),
      waketime: minutesToHm(nextBed + span),
    }
  }
  return next
}

export function tibMatchesGoal(
  bedtime: string,
  waketime: string,
  goalHours: number,
  epsilonHours = 1 / 60,
): boolean {
  const tib = computeTibHours(bedtime, waketime)
  if (tib == null) return false
  return Math.abs(tib - goalHours) <= epsilonHours
}
