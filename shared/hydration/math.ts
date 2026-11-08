/**
 * Calculs d’affichage hydratation autorisés (Archi §2) — fonctions pures.
 */
import {
  CLASSIC_BOTTLE_ML,
  CONTAINER_MAX_ML,
  CONTAINER_MIN_ML,
  GLASS_ML,
  GOAL_MAX_ML,
  GOAL_MIN_ML,
  HIGH_INFO_THRESHOLD_ML,
  type HydrationEntrySource,
  type HydrationMode,
} from './constants'

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function remainingMl(goalMl: number, drunkMl: number): number {
  return Math.max(0, Math.round(goalMl) - Math.round(drunkMl))
}

/** Niveau d’eau du dessin : le dessin se vide (fillRatio = restant / objectif). */
export function fillRatio(goalMl: number, drunkMl: number): number {
  const goal = Math.max(1, Math.round(goalMl))
  const rem = remainingMl(goal, drunkMl)
  return clamp(rem / goal, 0, 1)
}

export function showHighInfo(drunkMl: number): boolean {
  return Math.round(drunkMl) >= HIGH_INFO_THRESHOLD_ML
}

export function clampGoalMl(ml: number): number {
  return clamp(Math.round(ml), GOAL_MIN_ML, GOAL_MAX_ML)
}

export function isValidGoalMl(ml: unknown): ml is number {
  return typeof ml === 'number' && Number.isFinite(ml) && Number.isInteger(ml)
    && ml >= GOAL_MIN_ML
    && ml <= GOAL_MAX_ML
}

export function isValidContainerMl(ml: unknown): ml is number {
  return typeof ml === 'number' && Number.isFinite(ml) && Number.isInteger(ml)
    && ml >= CONTAINER_MIN_ML
    && ml <= CONTAINER_MAX_ML
}

/** Volume de référence pour +½ / +bouteille selon le mode. */
export function containerVolumeMl(
  mode: HydrationMode,
  myBottleVolumeMl: number | null | undefined,
): number {
  if (mode === 'glasses_250') return GLASS_ML
  if (mode === 'my_bottle' && isValidContainerMl(myBottleVolumeMl ?? NaN)) {
    return myBottleVolumeMl as number
  }
  return CLASSIC_BOTTLE_ML
}

export function quickAddAmountMl(
  source: HydrationEntrySource,
  mode: HydrationMode,
  myBottleVolumeMl: number | null | undefined,
): number {
  const volume = containerVolumeMl(mode, myBottleVolumeMl)
  switch (source) {
    case 'glass':
      return GLASS_ML
    case 'half_bottle':
      return Math.round(volume / 2)
    case 'full_bottle':
      return volume
    case 'slider':
      return GLASS_ML
    default:
      return GLASS_ML
  }
}

/** Affichage litres FR : « 0,8 L ». */
export function formatLitersFr(ml: number): string {
  const liters = Math.max(0, ml) / 1000
  if (Number.isInteger(liters)) return `${liters} L`
  return `${liters.toFixed(1).replace('.', ',')} L`
}

export function formatRemainingLabel(goalMl: number, drunkMl: number): string {
  return `${formatLitersFr(remainingMl(goalMl, drunkMl))} restant`
}

export function formatDrunkLabel(drunkMl: number): string {
  return `${formatLitersFr(drunkMl)} bu`
}

/** dayKey local YYYY-MM-DD. */
export function localDayKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidDayKey(dayKey: unknown): dayKey is string {
  if (typeof dayKey !== 'string' || !DAY_KEY_RE.test(dayKey)) return false
  const [ys, ms, ds] = dayKey.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Écart en jours calendaires UTC entre dayKey client et « aujourd’hui » serveur. */
export function dayKeyOffsetFromServer(dayKey: string, serverNow = Date.now()): number {
  if (!isValidDayKey(dayKey)) return Number.POSITIVE_INFINITY
  const [ys, ms, ds] = dayKey.split('-').map(Number)
  const clientUtc = Date.UTC(ys, ms - 1, ds)
  const server = new Date(serverNow)
  const serverUtc = Date.UTC(server.getUTCFullYear(), server.getUTCMonth(), server.getUTCDate())
  return Math.round((clientUtc - serverUtc) / 86_400_000)
}

export function isDayKeyWithinTolerance(dayKey: string, serverNow = Date.now()): boolean {
  const offset = dayKeyOffsetFromServer(dayKey, serverNow)
  return Number.isFinite(offset) && Math.abs(offset) <= 1
}

/** HH:MM dans 08:00–21:00 (hors quiet 21–08). */
export function isReminderTimeAllowed(hhmm: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return false
  const [h, m] = hhmm.split(':').map(Number)
  if (h < 0 || h > 23 || m < 0 || m > 59) return false
  const mins = h * 60 + m
  const quietStart = 21 * 60
  const quietEnd = 8 * 60
  // Allowed window: [08:00, 21:00)
  return mins >= quietEnd && mins < quietStart
}

export function shiftDayKey(dayKey: string, deltaDays: number): string {
  if (!isValidDayKey(dayKey)) return dayKey
  const [ys, ms, ds] = dayKey.split('-').map(Number)
  const dt = new Date(Date.UTC(ys, ms - 1, ds))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function lastNDayKeys(endDayKey: string, n: number): string[] {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(shiftDayKey(endDayKey, -i))
  }
  return keys
}
