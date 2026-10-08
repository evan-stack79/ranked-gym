/**
 * Pure ranking / points helpers for « Classement de ma salle ».
 * Shared by Convex mutations and unit tests — no DB I/O.
 */

/** Max counted sessions per calendar week (OMS-inspired, Vérificateur). */
export const MAX_COUNTED_SESSIONS_PER_WEEK = 2

/** Max 1 validated session per day (server-enforced). */
export const MAX_COUNTED_SESSIONS_PER_DAY = 1

/** Reject presence older than this many days (réglage de départ). */
export const MAX_VISIT_AGE_DAYS = 7

/** Visit days retained 60 days then deleted. */
export const VISIT_RETENTION_DAYS = 60

/** Google place lat/lng retained max 30 days then cleared. */
export const GOOGLE_LOC_RETENTION_DAYS = 30

/** Gym change cooldown (réglage de départ). */
export const GYM_CHANGE_COOLDOWN_DAYS = 30

/** Min members before a gym ranking is shown. */
export const MIN_GYM_MEMBERS_FOR_RANKING = 3

/** Presence radius on phone: (distance − accuracy) ≤ this (meters). */
export const PRESENCE_RADIUS_M = 150

/** If phone accuracy worse than this, ask to retry near entrance. */
export const PRESENCE_MAX_ACCURACY_M = 500

/** Google Places searches per user per day (réglage de départ). */
export const GOOGLE_SEARCH_DAILY_LIMIT = 20

export const GOOGLE_PLACES_API_KEY_ENV = 'GOOGLE_PLACES_API_KEY'

export type PeriodKind = 'week' | 'month'

export type VisitDay = {
  userId: string
  gymKey: string
  dateKey: string
}

export type RankedEntry = {
  userId: string
  pseudo: string
  points: number
  /** Dense rank: ties share the same rank (1, 1, 2… never broken by load/volume/time). */
  rank: number
}

/** YYYY-MM-DD → Date UTC noon (stable across DST). */
export function parseDateKeyUtc(dateKey: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim())
  if (!m) throw new Error('INVALID_DATE_KEY')
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
}

export function formatDateKeyUtc(date: Date): string {
  const y = date.getUTCFullYear()
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

/** Monday (UTC) of the week containing dateKey. */
export function mondayDateKeyOf(dateKey: string): string {
  const date = parseDateKeyUtc(dateKey)
  const day = date.getUTCDay() // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(date.getTime() + mondayOffset * 86_400_000)
  return formatDateKeyUtc(monday)
}

/** Monday-start week key: `W:YYYY-MM-DD` (Monday UTC). */
export function weekKeyFromDateKey(dateKey: string): string {
  return `W:${mondayDateKeyOf(dateKey)}`
}

export function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7) // YYYY-MM
}

export function dateKeysInWeek(weekKey: string): { start: string; end: string } {
  const m = /^W:(\d{4}-\d{2}-\d{2})$/.exec(weekKey)
  if (!m) throw new Error('INVALID_WEEK_KEY')
  const start = m[1]!
  const monday = parseDateKeyUtc(start)
  const sunday = new Date(monday.getTime() + 6 * 86_400_000)
  return { start, end: formatDateKeyUtc(sunday) }
}

export function dateKeysInMonth(monthKey: string): { start: string; end: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey)
  if (!m) throw new Error('INVALID_MONTH_KEY')
  const y = Number(m[1])
  const mo = Number(m[2])
  const start = `${m[1]}-${m[2]}-01`
  const lastDay = new Date(Date.UTC(y, mo, 0, 12)).getUTCDate()
  const end = `${m[1]}-${m[2]}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function daysBetweenDateKeys(earlier: string, later: string): number {
  const a = parseDateKeyUtc(earlier).getTime()
  const b = parseDateKeyUtc(later).getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * Server gate for a late/offline presence: reject if visit day is > MAX_VISIT_AGE_DAYS
 * before "today", or in the future.
 */
export function assertVisitDateAcceptable(
  visitDateKey: string,
  todayDateKey: string,
): { ok: true } | { ok: false; reason: 'too_old' | 'future' | 'invalid' } {
  try {
    const age = daysBetweenDateKeys(visitDateKey, todayDateKey)
    if (age < 0) return { ok: false, reason: 'future' }
    if (age > MAX_VISIT_AGE_DAYS) return { ok: false, reason: 'too_old' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

/**
 * Count points for one user from visit dateKeys in a period.
 * - Unique days only (caller should already dedupe; we dedupe again)
 * - Max MAX_COUNTED_SESSIONS_PER_WEEK per weekKey
 * Never uses load, volume, body, or arrival time.
 */
export function countPointsFromVisitDateKeys(dateKeys: string[]): number {
  const unique = [...new Set(dateKeys.filter(Boolean))].sort()
  const byWeek = new Map<string, number>()
  for (const dk of unique) {
    const wk = weekKeyFromDateKey(dk)
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1)
  }
  let points = 0
  for (const count of byWeek.values()) {
    points += Math.min(MAX_COUNTED_SESSIONS_PER_WEEK, count)
  }
  return points
}

/**
 * Dense ranking: equal points → same rank; next distinct score → rank + 1.
 * Order within a tie is stable by pseudo then userId (display only — never a tie-break for rank).
 */
export function denseRankEntries(
  entries: Array<{ userId: string; pseudo: string; points: number }>,
): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const p = a.pseudo.localeCompare(b.pseudo, 'fr')
    if (p !== 0) return p
    return a.userId.localeCompare(b.userId)
  })
  const out: RankedEntry[] = []
  let rank = 0
  let prevPoints: number | null = null
  for (const e of sorted) {
    if (prevPoints === null || e.points !== prevPoints) {
      rank += 1
      prevPoints = e.points
    }
    out.push({ userId: e.userId, pseudo: e.pseudo, points: e.points, rank })
  }
  return out
}

/** Group podium slots: rank → list of entries (for « 1er · 12 personnes »). */
export function groupByRank(ranked: RankedEntry[]): Map<number, RankedEntry[]> {
  const map = new Map<number, RankedEntry[]>()
  for (const e of ranked) {
    const list = map.get(e.rank) ?? []
    list.push(e)
    map.set(e.rank, list)
  }
  return map
}

export function frenchOrdinalRank(rank: number): string {
  if (rank === 1) return '1er'
  return `${rank}e`
}

export function isGoogleLocExpired(locFetchedAt: number | null | undefined, nowMs: number): boolean {
  if (locFetchedAt == null) return true
  return nowMs - locFetchedAt > GOOGLE_LOC_RETENTION_DAYS * 86_400_000
}

export function visitDateKeyExpired(dateKey: string, todayDateKey: string): boolean {
  try {
    return daysBetweenDateKeys(dateKey, todayDateKey) > VISIT_RETENTION_DAYS
  } catch {
    return true
  }
}

/** Haversine distance in meters. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Phone-side presence decision (never sent as coordinates).
 * - accuracy > 500 → inconclusive
 * - (distance − accuracy) ≤ 150 → at gym
 */
export function decidePresenceOnPhone(args: {
  userLat: number
  userLng: number
  accuracyM: number
  gymLat: number
  gymLng: number
}): 'at_gym' | 'not_at_gym' | 'imprecise' {
  if (!(args.accuracyM >= 0) || args.accuracyM > PRESENCE_MAX_ACCURACY_M) {
    return 'imprecise'
  }
  const distance = haversineMeters(args.userLat, args.userLng, args.gymLat, args.gymLng)
  if (distance - args.accuracyM <= PRESENCE_RADIUS_M) return 'at_gym'
  return 'not_at_gym'
}

export function googleGymKey(placeId: string): string {
  return `google:${placeId.trim()}`
}

export function manualGymKey(id: string): string {
  return `manual:${id.trim()}`
}

export function isManualGymKey(gymKey: string): boolean {
  return gymKey.startsWith('manual:')
}

export function isGoogleGymKey(gymKey: string): boolean {
  return gymKey.startsWith('google:')
}
