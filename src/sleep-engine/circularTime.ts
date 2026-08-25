/**
 * Représentation circulaire du temps sur 24 h.
 * 23:50 et 00:10 sont proches (20 min), pas ~24 h.
 */

export const MINUTES_PER_DAY = 24 * 60

/** Minutes depuis minuit ∈ [0, 1440). */
export function minutesOfDay(totalMinutes: number): number {
  const m = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return m
}

/**
 * Parse une heure en minutes depuis minuit.
 * Accepte ISO datetime, ou HH:MM / HH:MM:SS.
 */
export function parseTimeToMinutes(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // ISO / datetime
  const asDate = Date.parse(trimmed)
  if (!Number.isNaN(asDate)) {
    const d = new Date(asDate)
    return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60
  }

  const hm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed)
  if (!hm) return null
  const h = Number(hm[1])
  const m = Number(hm[2])
  const s = hm[3] != null ? Number(hm[3]) : 0
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null
  return h * 60 + m + s / 60
}

/** Écart circulaire absolu en minutes (0–720). */
export function circularDiffMinutes(a: number, b: number): number {
  const diff = Math.abs(minutesOfDay(a) - minutesOfDay(b))
  return Math.min(diff, MINUTES_PER_DAY - diff)
}

/**
 * Écart-type circulaire (minutes) via représentation angle 2π.
 * Retourne null si moins de 2 échantillons.
 */
export function circularStdDevMinutes(samples: number[]): number | null {
  if (samples.length < 2) return null

  const angles = samples.map((m) => (minutesOfDay(m) / MINUTES_PER_DAY) * 2 * Math.PI)
  const meanSin = angles.reduce((s, a) => s + Math.sin(a), 0) / angles.length
  const meanCos = angles.reduce((s, a) => s + Math.cos(a), 0) / angles.length
  const R = Math.hypot(meanSin, meanCos)

  // Variance circulaire : 1 − R ; σ ≈ √(−2 ln R) en radians
  if (R >= 1) return 0
  if (R <= 0) return MINUTES_PER_DAY / (2 * Math.SQRT2) // dispersion maximale approximée

  const sigmaRad = Math.sqrt(-2 * Math.log(R))
  return (sigmaRad / (2 * Math.PI)) * MINUTES_PER_DAY
}

/**
 * Durée TIB (heures) bedtime → waketime, gère le passage minuit.
 * Si timestamps ISO complets avec dates, utilise la différence absolue.
 * Sinon suppose une nuit unique (waketime le lendemain si ≤ bedtime).
 */
export function computeTibHours(bedtime: string, waketime: string): number | null {
  const bedMs = Date.parse(bedtime.trim())
  const wakeMs = Date.parse(waketime.trim())

  if (!Number.isNaN(bedMs) && !Number.isNaN(wakeMs)) {
    const deltaMs = wakeMs - bedMs
    if (deltaMs <= 0) return null
    return deltaMs / (1000 * 60 * 60)
  }

  const bedMin = parseTimeToMinutes(bedtime)
  const wakeMin = parseTimeToMinutes(waketime)
  if (bedMin == null || wakeMin == null) return null

  let span = wakeMin - bedMin
  if (span <= 0) span += MINUTES_PER_DAY
  return span / 60
}
