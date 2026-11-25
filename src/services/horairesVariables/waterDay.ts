/**
 * Water day = wake → next wake when HV is active (état 26 A).
 * Otherwise callers keep shared/hydration localDayKey (calendar / 04:00).
 */

import { localDayKey } from '../../shared/hydration'
import {
  dateKeyOf,
  effectiveWakeForDay,
  parseHm,
  waterDayKeyWakeToWake,
} from '../../horaires-variables/engine'
import { getHvState, isHvModeActive } from './storage'
import { HV_WATER_DAY_PHRASE } from '../../horaires-variables/constants'

export { HV_WATER_DAY_PHRASE }

function wakeDate(dateKey: string, wakeHm: string): Date | null {
  const p = parseHm(wakeHm)
  if (!p) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d, p.hour, p.minute, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/**
 * Resolve hydration dayKey under HV wake→wake rule.
 */
export function hydrationDayKeyForHv(now = new Date()): string {
  if (!isHvModeActive()) return localDayKey(now)

  const { settings, days } = getHvState()
  if (!settings.enabled) return localDayKey(now)

  const sorted = [...days].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  let lastWake: Date | null = null
  let nextWake: Date | null = null

  for (const day of sorted) {
    const wakeHm = effectiveWakeForDay(day, settings.trajetMin, settings.prepMin)
    if (!wakeHm) continue
    const at = wakeDate(day.dateKey, wakeHm)
    if (!at) continue
    if (at.getTime() <= now.getTime()) {
      lastWake = at
    } else if (!nextWake) {
      nextWake = at
    }
  }

  if (!lastWake) {
    // Fallback: treat today's calendar wake from planning if in the future still use calendar
    return localDayKey(now)
  }

  return waterDayKeyWakeToWake({
    now,
    lastWakeAt: lastWake.toISOString(),
    nextWakeAt: nextWake?.toISOString() ?? null,
  })
}

export function waterDayExplainer(): string {
  return HV_WATER_DAY_PHRASE
}

/** For tests: build day key from explicit last wake. */
export function waterDayKeyFromLastWake(lastWakeAt: Date, now = new Date()): string {
  return waterDayKeyWakeToWake({
    now,
    lastWakeAt: lastWakeAt.toISOString(),
  })
}

export function calendarFallbackKey(now = new Date()): string {
  return dateKeyOf(now)
}
