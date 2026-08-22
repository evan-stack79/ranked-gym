interface ReverseGeocodeCacheEntry {
  city: string
  cachedAt: number
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const memoryCache = new Map<string, ReverseGeocodeCacheEntry>()

interface PhotonReverseFeature {
  properties?: {
    name?: string
    city?: string
    town?: string
    municipality?: string
    village?: string
    state?: string
    country?: string
  }
}

interface NominatimReverseResult {
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    hamlet?: string
    county?: string
  }
  display_name?: string
}

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`
}

function readCache(lat: number, lng: number): string | null {
  const key = cacheKey(lat, lng)
  const hit = memoryCache.get(key)
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) return hit.city

  try {
    const raw = sessionStorage.getItem(`ranked-gym:revgeo:${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReverseGeocodeCacheEntry
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null
    memoryCache.set(key, parsed)
    return parsed.city
  } catch {
    return null
  }
}

function writeCache(lat: number, lng: number, city: string): void {
  const key = cacheKey(lat, lng)
  const entry = { city, cachedAt: Date.now() }
  memoryCache.set(key, entry)
  try {
    sessionStorage.setItem(`ranked-gym:revgeo:${key}`, JSON.stringify(entry))
  } catch {
    // quota / private mode
  }
}

function pickCityFromPhotonProps(
  props: PhotonReverseFeature['properties'],
): string | null {
  if (!props) return null
  const candidate =
    props.city ||
    props.town ||
    props.municipality ||
    props.village ||
    props.name ||
    null
  return candidate?.trim() || null
}

function pickCityFromNominatim(payload: NominatimReverseResult): string | null {
  const addr = payload.address
  if (addr) {
    const candidate =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.hamlet ||
      addr.county
    if (candidate?.trim()) return candidate.trim()
  }
  const first = payload.display_name?.split(',')[0]?.trim()
  return first || null
}

async function reverseGeocodeWithPhoton(lat: number, lng: number): Promise<string | null> {
  const url = new URL('https://photon.komoot.io/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('lang', 'fr')

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) return null

  const payload = (await response.json()) as { features?: PhotonReverseFeature[] }
  for (const feature of payload.features ?? []) {
    const city = pickCityFromPhotonProps(feature.properties)
    if (city) return city
  }
  return null
}

async function reverseGeocodeWithNominatim(lat: number, lng: number): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('zoom', '10')
  url.searchParams.set('addressdetails', '1')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RankedGym/1.0 (https://ranked-gym.lembrezevan.workers.dev)',
    },
  })
  if (!response.ok) return null

  const payload = (await response.json()) as NominatimReverseResult
  return pickCityFromNominatim(payload)
}

/** Reverse geocoding gratuit (Photon → Nominatim). Retourne le nom de ville ou null. */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const cached = readCache(lat, lng)
  if (cached) return cached

  const attempts = [
    () => reverseGeocodeWithPhoton(lat, lng),
    () => reverseGeocodeWithNominatim(lat, lng),
  ]

  for (const attempt of attempts) {
    try {
      const city = await attempt()
      if (city) {
        writeCache(lat, lng, city)
        return city
      }
    } catch {
      // try next provider
    }
  }

  return null
}
