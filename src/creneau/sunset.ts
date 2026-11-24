/**
 * Lever / coucher du soleil sans réseau (SCIENCE_42 §4, B2, avis Vérificateur).
 * Méthode NOAA / Meeus — précision ~1 min. Heure affichée arrondie aux 5 min
 * AVANT (jamais après). Phrase imposée : « Le soleil se couche à HH:MM. »
 */

export const TERGNIER_COORDS = {
  name: 'Tergnier',
  latitude: 49.6558,
  longitude: 3.3003,
} as const

export const PARIS_COORDS = {
  name: 'Paris',
  latitude: 48.8566,
  longitude: 2.3522,
} as const

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0)
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((now - start) / 86_400_000)
}

/** Minutes depuis minuit → HH:MM. */
export function formatMinutesHm(minutesFromMidnight: number): string {
  const m = ((Math.round(minutesFromMidnight) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/**
 * Arrondi aux 5 minutes AVANT (floor), jamais après.
 * Ex. 16:56 → 16:55 ; 16:55 → 16:55 ; 17:00 → 17:00.
 */
export function floorHmTo5Minutes(hm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return hm
  const total = Number(m[1]) * 60 + Number(m[2])
  if (!Number.isFinite(total)) return hm
  const floored = Math.floor(total / 5) * 5
  return formatMinutesHm(floored)
}

export function floorMinutesTo5(minutesFromMidnight: number): number {
  return Math.floor(minutesFromMidnight / 5) * 5
}

/**
 * Offset UTC (minutes) pour Europe/Paris au jour civil de `date`.
 * Indépendant du fuseau de la VM / du navigateur.
 */
export function europeParisUtcOffsetMinutes(date: Date): number {
  const y = date.getFullYear()
  const mo = date.getMonth()
  const d = date.getDate()
  // Midi UTC du jour civil → lire l'offset Paris via Intl
  const probe = new Date(Date.UTC(y, mo, d, 12, 0, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
    hour: 'numeric',
  }).formatToParts(probe)
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  const match = /([+-])(\d{1,2})(?::?(\d{2}))?/.exec(tz)
  if (!match) return 60
  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const mins = Number(match[3] ?? '0')
  return sign * (hours * 60 + mins)
}

export type SunTimes = {
  sunriseHm: string
  sunsetHm: string
  /** Coucher affiché (floor 5 min). */
  sunsetDisplayHm: string
  /** True when polar day/night — treat as unknown. */
  unknown: boolean
}

export type ComputeSunTimesOpts = {
  /** Override offset (tests). Default = Europe/Paris for the calendar day. */
  utcOffsetMinutes?: number
}

/**
 * Sunrise / sunset for the local calendar day of `date` at lat/lng.
 * Based on the NOAA solar calculator approximation (declination + hour angle).
 */
export function computeSunTimes(
  date: Date,
  latitude: number = PARIS_COORDS.latitude,
  longitude: number = PARIS_COORDS.longitude,
  opts: ComputeSunTimesOpts = {},
): SunTimes {
  const N = dayOfYear(date)
  const gamma = ((2 * Math.PI) / 365) * (N - 1)
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)
  const declDeg = toDegrees(declRad)

  const latR = toRadians(latitude)
  const declR = toRadians(declDeg)
  const zenith = toRadians(90.833)
  const cosH =
    (Math.cos(zenith) - Math.sin(latR) * Math.sin(declR)) /
    (Math.cos(latR) * Math.cos(declR))
  if (cosH < -1 || cosH > 1) {
    return {
      sunriseHm: '06:00',
      sunsetHm: '18:00',
      sunsetDisplayHm: '18:00',
      unknown: true,
    }
  }
  const haDeg = toDegrees(Math.acos(clamp(cosH, -1, 1)))
  const solarNoonUtc = 720 - 4 * longitude - eqTime
  const sunriseUtc = solarNoonUtc - haDeg * 4
  const sunsetUtc = solarNoonUtc + haDeg * 4
  const offsetMin =
    opts.utcOffsetMinutes ?? europeParisUtcOffsetMinutes(date)

  const sunrise = sunriseUtc + offsetMin
  const sunset = sunsetUtc + offsetMin
  const sunsetHm = formatMinutesHm(sunset)
  return {
    sunriseHm: formatMinutesHm(sunrise),
    sunsetHm,
    sunsetDisplayHm: floorHmTo5Minutes(sunsetHm),
    unknown: false,
  }
}

/** True if hm is at/after sunsetDisplay or before sunrise (night window). */
export function isAfterSunsetHm(
  hm: string,
  sunsetHm: string,
  sunriseHm = '06:00',
): boolean {
  const parse = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
    if (!m) return null
    return Number(m[1]) * 60 + Number(m[2])
  }
  const t = parse(hm)
  const set = parse(sunsetHm)
  const rise = parse(sunriseHm)
  if (t == null || set == null || rise == null) return true // protecteur
  return t >= set || t < rise
}

/** Phrase imposée (Vérificateur) — jamais « Il fera nuit ». */
export function formatSoleilSeCouchePhrase(sunsetDisplayHm: string): string {
  return `Le soleil se couche à ${sunsetDisplayHm}.`
}
