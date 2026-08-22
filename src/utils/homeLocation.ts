import { getActiveCheckIn, getLastLocationLabel } from '../services/lobbyStorage'
import { reverseGeocodeCity } from '../services/reverseGeocode'

const GPS_LABELS = new Set(['position gps', 'gps'])

function extractCityFromLabel(label: string): string | null {
  const trimmed = label.trim()
  if (!trimmed) return null
  if (GPS_LABELS.has(trimmed.toLowerCase())) return null

  const beforeComma = trimmed.split(',')[0]?.trim()
  if (beforeComma && beforeComma.length <= 40 && !GPS_LABELS.has(beforeComma.toLowerCase())) {
    return beforeComma
  }
  return null
}

function extractCityFromAddress(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    if (candidate && !/^\d/.test(candidate)) return candidate
  }
  return extractCityFromLabel(address)
}

export interface HomeAreaCoords {
  lat: number
  lng: number
}

/** Ville connue immédiatement (label manuel ou adresse check-in). */
export function resolveHomeAreaNameSync(): string | null {
  const checkIn = getActiveCheckIn()
  if (checkIn?.gym?.address) {
    const city = extractCityFromAddress(checkIn.gym.address)
    if (city) return city
  }

  const last = getLastLocationLabel()
  if (last?.label) {
    const city = extractCityFromLabel(last.label)
    if (city) return city
  }

  return null
}

/** Coordonnées disponibles pour reverse geocoding. */
export function resolveHomeAreaCoords(): HomeAreaCoords | null {
  const checkIn = getActiveCheckIn()
  if (checkIn?.gym?.lat != null && checkIn?.gym?.lng != null) {
    return { lat: checkIn.gym.lat, lng: checkIn.gym.lng }
  }

  const last = getLastLocationLabel()
  if (last?.lat != null && last?.lng != null) {
    return { lat: last.lat, lng: last.lng }
  }

  return null
}

/** Ville via reverse geocoding si nécessaire. Null = afficher « autour de vous ». */
export async function resolveHomeAreaNameAsync(): Promise<string | null> {
  const sync = resolveHomeAreaNameSync()
  if (sync) return sync

  const coords = resolveHomeAreaCoords()
  if (!coords) return null

  return reverseGeocodeCity(coords.lat, coords.lng)
}
