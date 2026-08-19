import type { NearbyGym } from '../types'
import { haversineDistanceMeters, CHECK_IN_RADIUS_METERS, SEARCH_RADIUS_METERS } from '../utils/geo'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
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

function buildOverpassQuery(lat: number, lng: number, radiusMeters: number): string {
  return `
    [out:json][timeout:25];
    (
      node["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lng});
      way["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lng});
      relation["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lng});
      node["sport"="fitness"](around:${radiusMeters},${lat},${lng});
      way["sport"="fitness"](around:${radiusMeters},${lat},${lng});
      relation["sport"="fitness"](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `.trim()
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

  const name = element.tags?.name?.trim()
  if (!name) return null

  const distanceMeters = haversineDistanceMeters(userLat, userLng, lat, lng)

  return {
    id: `${element.type}-${element.id}`,
    name,
    lat,
    lng,
    address: parseAddress(element.tags),
    distanceMeters,
  }
}

function dedupeGyms(gyms: Omit<NearbyGym, 'canCheckIn'>[]): Omit<NearbyGym, 'canCheckIn'>[] {
  const seen = new Map<string, Omit<NearbyGym, 'canCheckIn'>>()

  for (const gym of gyms) {
    const key = gym.name.toLowerCase()
    const existing = seen.get(key)
    if (!existing || gym.distanceMeters < existing.distanceMeters) {
      seen.set(key, gym)
    }
  }

  return [...seen.values()].sort((a, b) => a.distanceMeters - b.distanceMeters)
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
  radiusMeters = SEARCH_RADIUS_METERS,
): Promise<NearbyGym[]> {
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
        canCheckIn: gym.distanceMeters <= CHECK_IN_RADIUS_METERS,
      }))
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown Overpass error')
    }
  }

  throw lastError ?? new Error('Impossible de contacter l\'API Overpass.')
}
