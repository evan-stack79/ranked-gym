import type { GeoCoordinates, NearbyGym } from '../types'
import {
  CHECK_IN_RADIUS_METERS,
  SEARCH_RADIUS_METERS,
  haversineDistanceMeters,
  isValidDistanceMeters,
  toFiniteNumber,
} from '../utils/geo'
import {
  getDiscipline,
  getStoredDisciplineId,
  type AppDisciplineId,
} from '../data/disciplines'

export class GooglePlacesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GooglePlacesError'
  }
}

export interface GeocodedPlace {
  coords: GeoCoordinates
  label: string
}

interface PlacesSearchOptions {
  radiusMeters?: number
  allowAllCheckIn?: boolean
  /** App discipline id — widens Places search beyond gyms */
  disciplineId?: string
}

interface GooglePlaceResult {
  place_id?: string
  name?: string
  vicinity?: string
  formatted_address?: string
  /** LatLng objects expose lat/lng as methods; literals expose numbers. */
  geometry?: {
    location?: {
      lat?: number | string | (() => number)
      lng?: number | string | (() => number)
    }
  }
  rating?: number
  user_ratings_total?: number
  types?: string[]
}

interface GoogleGeocodeResult {
  formatted_address?: string
  geometry?: {
    location?: {
      lat?: number | string | (() => number)
      lng?: number | string | (() => number)
    }
  }
}

/** Declared so we can load the Maps JS SDK without @types/google.maps. */
interface GoogleMapsWindow {
  google?: {
    maps: {
      places: {
        PlacesServiceStatus: { OK: string; ZERO_RESULTS: string }
        PlacesService: new (attrContainer: HTMLDivElement) => {
          nearbySearch: (
            request: {
              location: { lat: number; lng: number }
              radius: number
              type?: string
              keyword?: string
            },
            callback: (results: GooglePlaceResult[] | null, status: string) => void,
          ) => void
        }
      }
      Geocoder: new () => {
        geocode: (
          request: { address: string },
          callback: (results: GoogleGeocodeResult[] | null, status: string) => void,
        ) => void
      }
    }
  }
}

function getApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? ''
}

export function isMockPlacesMode(): boolean {
  return getApiKey().length === 0
}

function offsetCoords(
  lat: number,
  lng: number,
  distanceMeters: number,
  bearingDegrees: number,
): { lat: number; lng: number } {
  const bearing = (bearingDegrees * Math.PI) / 180
  const dy = distanceMeters * Math.cos(bearing)
  const dx = distanceMeters * Math.sin(bearing)
  const dLat = dy / 111_320
  const dLng = dx / (111_320 * Math.cos((lat * Math.PI) / 180))
  return { lat: lat + dLat, lng: lng + dLng }
}

function buildMockGyms(userLat: number, userLng: number, disciplineId?: AppDisciplineId): NearbyGym[] {
  const disc = getDiscipline(disciplineId ?? getStoredDisciplineId())
  const templates = [
    {
      id: `mock-spot-1-${disc.id}`,
      name:
        disc.id === 'course'
          ? 'Piste d’athlétisme municipale'
          : disc.id === 'football'
            ? 'Terrain synthétique municipal'
            : disc.id === 'combat'
              ? 'Club Boxe & MMA'
              : disc.id === 'cyclisme'
                ? 'Boucle cyclable / parc'
                : disc.id === 'crossfit'
                  ? 'Box CrossFit Locale'
                  : 'Espace Forme',
      address: '12 Avenue Jean Jaurès',
      distanceMeters: 600,
      bearing: 35,
      rating: 4.8,
      userRatingsTotal: 214,
      spotKind: disc.spotLabel,
    },
    {
      id: `mock-spot-2-${disc.id}`,
      name:
        disc.id === 'course'
          ? 'Parc & parcours running'
          : disc.id === 'football'
            ? 'Gymnase multisports'
            : disc.id === 'combat'
              ? 'Dojo municipal'
              : 'Basic-Fit / Club sport',
      address: 'Zone Commerciale',
      distanceMeters: 1200,
      bearing: 140,
      rating: 4.5,
      userRatingsTotal: 487,
      spotKind: disc.spotLabel,
    },
    {
      id: `mock-spot-3-${disc.id}`,
      name: 'Complexe sportif Léo Lagrange',
      address: 'Rue Léo Lagrange',
      distanceMeters: 2000,
      bearing: 250,
      rating: 4.2,
      userRatingsTotal: 96,
      spotKind: 'Spot sport',
    },
  ]

  const mockCheckInRadius = 700

  return templates.map((template) => {
    const coords = offsetCoords(
      Number(userLat),
      Number(userLng),
      Number(template.distanceMeters),
      Number(template.bearing),
    )
    const lat = Number(coords.lat)
    const lng = Number(coords.lng)
    const distanceMeters = Number(template.distanceMeters)

    return {
      id: template.id,
      name: template.name,
      lat,
      lng,
      address: template.address,
      distanceMeters,
      rating: Number(template.rating),
      userRatingsTotal: Number(template.userRatingsTotal),
      canCheckIn: distanceMeters <= mockCheckInRadius,
      isCustom: false,
      spotKind: template.spotKind,
    }
  })
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

let mapsScriptPromise: Promise<void> | null = null

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  const win = window as unknown as GoogleMapsWindow
  if (win.google?.maps?.places) {
    return Promise.resolve()
  }

  if (mapsScriptPromise) return mapsScriptPromise

  mapsScriptPromise = new Promise<void>((resolve, reject) => {
    const scriptId = 'ranked-gym-google-maps'
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null

    const handleLoad = () => {
      if (win.google?.maps?.places) resolve()
      else reject(new GooglePlacesError('Google Maps chargé, mais Places est indisponible.'))
    }

    if (existing) {
      if (win.google?.maps?.places) {
        resolve()
        return
      }
      existing.addEventListener('load', handleLoad)
      existing.addEventListener('error', () =>
        reject(new GooglePlacesError('Impossible de charger le SDK Google Maps.')),
      )
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=fr`
    script.onload = handleLoad
    script.onerror = () => {
      mapsScriptPromise = null
      reject(new GooglePlacesError('Impossible de charger le SDK Google Maps.'))
    }
    document.head.appendChild(script)
  })

  return mapsScriptPromise
}

type PlacesServiceInstance = {
  nearbySearch: (
    request: {
      location: { lat: number; lng: number }
      radius: number
      type?: string
      keyword?: string
    },
    callback: (results: GooglePlaceResult[] | null, status: string) => void,
  ) => void
}

function nearbySearchOnce(
  service: PlacesServiceInstance,
  request: {
    location: { lat: number; lng: number }
    radius: number
    type?: string
    keyword?: string
  },
  okStatus: string,
  zeroStatus: string,
): Promise<GooglePlaceResult[]> {
  return new Promise((resolve, reject) => {
    service.nearbySearch(request, (results, status) => {
      if (status === okStatus) {
        resolve(results ?? [])
        return
      }
      if (status === zeroStatus) {
        resolve([])
        return
      }
      reject(new GooglePlacesError(`Places Nearby Search a échoué (${status}).`))
    })
  })
}

function extractLatLng(location: unknown): { lat: number; lng: number } | null {
  if (location == null || typeof location !== 'object') return null
  const record = location as { lat?: unknown; lng?: unknown }
  const lat = toFiniteNumber(record.lat)
  const lng = toFiniteNumber(record.lng)
  if (lat == null || lng == null) return null
  return { lat, lng }
}

function placeResultToGym(
  place: GooglePlaceResult,
  userLat: number,
  userLng: number,
  allowAllCheckIn: boolean,
): NearbyGym | null {
  const coords = extractLatLng(place.geometry?.location)
  if (!coords || !place.name) return null

  const rawDistance = haversineDistanceMeters(userLat, userLng, coords.lat, coords.lng)
  if (!isValidDistanceMeters(rawDistance)) return null

  const distanceMeters = Math.round(rawDistance)

  return {
    id: place.place_id
      ? `gplace-${place.place_id}`
      : `gplace-${place.name}-${coords.lat}-${coords.lng}`,
    name: place.name,
    lat: coords.lat,
    lng: coords.lng,
    address: place.vicinity ?? place.formatted_address,
    distanceMeters,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    canCheckIn: allowAllCheckIn || distanceMeters <= CHECK_IN_RADIUS_METERS,
    isCustom: false,
  }
}

function dedupeGyms(gyms: NearbyGym[]): NearbyGym[] {
  const byId = new Map<string, NearbyGym>()
  for (const gym of gyms.sort((a, b) => a.distanceMeters - b.distanceMeters)) {
    if (!byId.has(gym.id)) byId.set(gym.id, gym)
  }
  return [...byId.values()]
}

async function fetchNearbyGymsFromGoogle(
  userLat: number,
  userLng: number,
  options: PlacesSearchOptions,
): Promise<NearbyGym[]> {
  const safeUserLat = toFiniteNumber(userLat)
  const safeUserLng = toFiniteNumber(userLng)
  if (safeUserLat == null || safeUserLng == null) {
    throw new GooglePlacesError('Position utilisateur invalide pour Google Places.')
  }

  const apiKey = getApiKey()
  await loadGoogleMapsScript(apiKey)

  const win = window as unknown as GoogleMapsWindow
  const google = win.google
  if (!google?.maps?.places) {
    throw new GooglePlacesError('SDK Google Places indisponible.')
  }

  const radiusMeters = options.radiusMeters ?? SEARCH_RADIUS_METERS
  const allowAllCheckIn = options.allowAllCheckIn ?? false
  const service = new google.maps.places.PlacesService(document.createElement('div'))
  const { OK, ZERO_RESULTS } = google.maps.places.PlacesServiceStatus
  const location = { lat: safeUserLat, lng: safeUserLng }

  const discId = (options.disciplineId as AppDisciplineId | undefined) ?? getStoredDisciplineId()
  const queries = getDiscipline(discId).placeQueries
  const batches = await Promise.all(
    queries.map((q) =>
      nearbySearchOnce(
        service,
        {
          location,
          radius: radiusMeters,
          ...(q.type ? { type: q.type } : {}),
          ...(q.keyword ? { keyword: q.keyword } : {}),
        },
        OK,
        ZERO_RESULTS,
      ),
    ),
  )

  const mapped = batches
    .flat()
    .map((place) => placeResultToGym(place, safeUserLat, safeUserLng, allowAllCheckIn))
    .filter((gym): gym is NearbyGym => gym != null)
    .map((gym) => ({ ...gym, spotKind: getDiscipline(discId).spotLabel }))

  return dedupeGyms(mapped)
}

export async function fetchNearbyGyms(
  userLat: number,
  userLng: number,
  options: PlacesSearchOptions = {},
): Promise<NearbyGym[]> {
  const safeUserLat = toFiniteNumber(userLat)
  const safeUserLng = toFiniteNumber(userLng)
  if (safeUserLat == null || safeUserLng == null) {
    throw new GooglePlacesError('Coordonnées GPS invalides.')
  }

  if (isMockPlacesMode()) {
    await delay(650)
    const discId =
      (options.disciplineId as AppDisciplineId | undefined) ?? getStoredDisciplineId()
    const mocks = buildMockGyms(safeUserLat, safeUserLng, discId)
    if (options.allowAllCheckIn) {
      return mocks.map((gym) => ({ ...gym, canCheckIn: true }))
    }
    return mocks
  }

  try {
    return await fetchNearbyGymsFromGoogle(safeUserLat, safeUserLng, options)
  } catch (error) {
    if (error instanceof GooglePlacesError) throw error
    throw new GooglePlacesError(
      error instanceof Error ? error.message : 'Erreur Google Places inconnue.',
    )
  }
}

async function geocodeCityWithGoogle(cityQuery: string): Promise<GeocodedPlace> {
  const apiKey = getApiKey()
  await loadGoogleMapsScript(apiKey)

  const win = window as unknown as GoogleMapsWindow
  const google = win.google
  if (!google?.maps?.Geocoder) {
    throw new GooglePlacesError('Géocodeur Google indisponible.')
  }

  const geocoder = new google.maps.Geocoder()

  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: `${cityQuery}, France` }, (results, status) => {
      if (status !== 'OK' || !results?.[0]?.geometry?.location) {
        reject(
          new GooglePlacesError(
            status === 'ZERO_RESULTS'
              ? `Aucun résultat pour « ${cityQuery} ».`
              : `Géocodage impossible (${status}).`,
          ),
        )
        return
      }

      const first = results[0]
      const coords = extractLatLng(first.geometry?.location)
      if (!coords) {
        reject(new GooglePlacesError('Coordonnées de géocodage invalides.'))
        return
      }

      const label =
        first.formatted_address?.split(',').slice(0, 2).join(',').trim() ?? cityQuery

      resolve({
        coords: { lat: coords.lat, lng: coords.lng },
        label,
      })
    })
  })
}

/** Mock city center for Tergnier when no API key is configured. */
const MOCK_CITY_COORDS: Record<string, GeocodedPlace> = {
  tergnier: {
    coords: { lat: 49.6556, lng: 3.3011 },
    label: 'Tergnier, France',
  },
}

export async function geocodeCity(cityQuery: string): Promise<GeocodedPlace> {
  const query = cityQuery.trim()
  if (query.length < 2) {
    throw new GooglePlacesError('Entre au moins 2 caractères pour rechercher une ville.')
  }

  if (isMockPlacesMode()) {
    await delay(450)
    const normalized = query.toLowerCase()
    const known = Object.entries(MOCK_CITY_COORDS).find(([key]) => normalized.includes(key))
    if (known) return known[1]

    return {
      coords: { lat: 49.6556, lng: 3.3011 },
      label: `${query}, France`,
    }
  }

  return geocodeCityWithGoogle(query)
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
    rating: undefined,
    userRatingsTotal: undefined,
    canCheckIn: true,
    isCustom: true,
  }
}
