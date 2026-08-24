/**
 * Semaine civile locale : lundi 00:00:00.000 → dimanche 23:59:59.999
 * (fuseau du téléphone, pas UTC serveur).
 */
export function getLocalWeekBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = start.getDay() // 0 = dimanche … 6 = samedi
  const daysFromMonday = day === 0 ? 6 : day - 1
  start.setDate(start.getDate() - daysFromMonday)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

/** Timestamp de validation d’une séance (createdAt ms, sinon midi local du dateKey). */
export function workoutValidationMs(input: {
  createdAt?: number | null
  dateKey?: string | null
}): number | null {
  if (typeof input.createdAt === 'number' && Number.isFinite(input.createdAt) && input.createdAt > 0) {
    return input.createdAt
  }
  const key = input.dateKey?.trim() ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0).getTime()
}

export function isTimestampInLocalWeek(ms: number, now = new Date()): boolean {
  if (!Number.isFinite(ms)) return false
  const { start, end } = getLocalWeekBounds(now)
  return ms >= start.getTime() && ms <= end.getTime()
}
