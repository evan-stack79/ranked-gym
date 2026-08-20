const EARTH_RADIUS_METERS = 6_371_000

/** Coerce GPS / Places values (number | string | lat()/lng() methods) into a finite number. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'function') {
    try {
      return toFiniteNumber((value as () => unknown)())
    } catch {
      return null
    }
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function isValidDistanceMeters(meters: unknown): meters is number {
  return typeof meters === 'number' && Number.isFinite(meters) && meters >= 0
}

export function haversineDistanceMeters(
  lat1: unknown,
  lng1: unknown,
  lat2: unknown,
  lng2: unknown,
): number {
  const a = toFiniteNumber(lat1)
  const b = toFiniteNumber(lng1)
  const c = toFiniteNumber(lat2)
  const d = toFiniteNumber(lng2)

  if (a == null || b == null || c == null || d == null) {
    return Number.NaN
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(c - a)
  const dLng = toRad(d - b)
  const sinHalf =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(sinHalf), Math.sqrt(1 - sinHalf))
}

export function formatDistance(meters: number): string {
  if (!isValidDistanceMeters(meters)) {
    return 'Calcul…'
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

export const CHECK_IN_RADIUS_METERS = 200
export const SEARCH_RADIUS_METERS = 2000
