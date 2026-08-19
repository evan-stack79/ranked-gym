import type { NearbyGym } from '../types'
import { haversineDistanceMeters, CHECK_IN_RADIUS_METERS, SEARCH_RADIUS_METERS } from '../utils/geo'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const GYM_TAG_FILTERS: Array<[string, string]> = [
  ['leisure', 'fitness_centre'],
  ['leisure', 'sports_centre'],
  ['leisure', 'gym'],
  ['sport', 'fitness'],
  ['sport', 'weightlifting'],
  ['sport', 'bodybuilding'],
  ['sport', 'gymnastics'],
  ['club', 'sport'],
  ['amenity', 'gym'],
  ['building', 'gym'],
]

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

function buildTagQueries(radiusMeters: number, lat: number, lng: number): string {
  return GYM_TAG_FILTERS.map(([key, value]) => `
      node["${key}"="${value}"](around:${radiusMeters},${lat},${lng});
      way["${key}"="${value}"](around:${radiusMeters},${lat},${lng});
      relation["${key}"="${value}"](around:${radiusMeters},${lat},${lng});
    `).join('\n')
}

function buildOverpassQuery(lat: number, lng: number, radiusMeters: number): string {
  return `
    [out:json][timeout:30];
    (
      ${buildTagQueries(radiusMeters, lat, lng)}
    );
    out center;
  `.trim()
}

function resolveGymName(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null

  const fromAddress =
    tags['addr:housenumber'] && tags['addr:street']
      ? `${tags['addr:housenumber']} ${tags['addr:street']}`
      : null

  return tags.name?.trim() || tags.operator?.trim() || tags.brand?.trim() || fromAddress
}

function parseAddress(tags: Record<string, string> | undefined): string | undefined {
  if (!tags) return undefined
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'],
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : undefined
}

function elementToGym(
  element: OverpassElement,
  userLat: number,
  userLng: number,
): Omit<NearbyGym, 'canCheckIn'> | null {
  const lat = element.lat ?? element.center?.lat
  const lng = element.lon ?? element.center?.lon
  if (lat == null || lng == null) return null

  const name = resolveGymName(element.tags)
  if (!name) return null

  const distanceMeters = haversineDistanceMeters(userLat, userLng, lat, lng)

  return {
    id: `${element.type}-${element.id}`,
    name,
    lat,
    lng,
    address: parseAddress(element.tags),
    distanceMeters,
    isCustom: false,
  }
}

function dedupeGyms(gyms: Omit<NearbyGym, 'canCheckIn'>[]): Omit<NearbyGym, 'canCheckIn'>[] {
  const result: Omit<NearbyGym, 'canCheckIn'>[] = []

  for (const gym of gyms.sort((a, b) => a.distanceMeters - b.distanceMeters)) {
    const duplicate = result.find(
      (existing) =>
        existing.name.toLowerCase() === gym.name.toLowerCase() ||
        haversineDistanceMeters(existing.lat, existing.lng, gym.lat, gym.lng) < 40,
    )
    if (!duplicate) {
      result.push(gym)
    }
  }

  return result
}

async function fetchFromEndpoint(
  endpoint: string,
  query: string,
): Promise<OverpassResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  })

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`)
  }

  return response.json() as Promise<OverpassResponse>
}

export async function fetchNearbyGyms(
  userLat: number,
  userLng: number,
  options?: { radiusMeters?: number; allowAllCheckIn?: boolean },
): Promise<NearbyGym[]> {
  const radiusMeters = options?.radiusMeters ?? SEARCH_RADIUS_METERS
  const allowAllCheckIn = options?.allowAllCheckIn ?? false
  const query = buildOverpassQuery(userLat, userLng, radiusMeters)
  let lastError: Error | null = null

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const data = await fetchFromEndpoint(endpoint, query)
      const parsed = data.elements
        .map((el) => elementToGym(el, userLat, userLng))
        .filter((gym): gym is Omit<NearbyGym, 'canCheckIn'> => gym != null)

      return dedupeGyms(parsed).map((gym) => ({
        ...gym,
        canCheckIn: allowAllCheckIn || gym.distanceMeters <= CHECK_IN_RADIUS_METERS,
      }))
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown Overpass error')
    }
  }

  throw lastError ?? new Error('Impossible de contacter l\'API Overpass.')
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function createVirtualGym(
  name: string,
  lat: number,
  lng: number,
  addressLabel?: string,
): NearbyGym {
  const trimmed = name.trim()
  const id = `custom-${hashString(`${trimmed}-${lat}-${lng}`)}`

  return {
    id,
    name: trimmed,
    lat,
    lng,
    address: addressLabel ?? 'Lobby créé par la communauté',
    distanceMeters: 0,
    canCheckIn: true,
    isCustom: true,
  }
}
