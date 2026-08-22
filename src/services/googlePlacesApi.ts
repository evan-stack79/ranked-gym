import type { GeoCoordinates, NearbyGym } from '../types'
import { safeWarn } from '../utils/safeLog'
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

/** Types Google Places acceptés pour muscu / fitness (Lobby force). */
const GYM_ALLOWED_TYPES = new Set(['gym', 'fitness_center'])

/** Types à exclure systématiquement (grande distribution, commerces). */
const RETAIL_DENIED_TYPES = new Set([
  'supermarket',
  'grocery_or_supermarket',
  'convenience_store',
  'department_store',
  'shopping_mall',
  'store',
  'hardware_store',
  'home_goods_store',
  'clothing_store',
  'shoe_store',
  'electronics_store',
  'furniture_store',
  'pharmacy',
  'bakery',
  'meal_takeaway',
  'restaurant',
  'food',
  'gas_station',
  'car_dealer',
  'car_repair',
  'bank',
  'atm',
  'lodging',
  'school',
  'church',
  'hospital',
  'doctor',
  'dentist',
  'veterinary_care',
  'pet_store',
  'beauty_salon',
  'hair_care',
  'spa',
  'lawyer',
  'real_estate_agency',
  'insurance_agency',
  'travel_agency',
  'post_office',
  'local_government_office',
])

/** Arts martiaux — exclus pour muscu / fitness pur. */
const MARTIAL_ARTS_DENIED_TYPES = new Set(['martial_arts_school'])

const RETAIL_DENIED_NAME =
  /\b(e\.?\s?leclerc|leclerc|carrefour|auchan|intermarche|lidl|aldi|casino|super\s?u|monoprix|franprix|picard|hyper\s?u|supermarche|supermarché|hypermarché|market|drive)\b/i

const MARTIAL_ARTS_DENIED_NAME =
  /\b(dojo|karat[ée]|judo|aikido|taekwondo|kung\s?fu|arts?\s?martiaux|jujitsu|jjb|bjj|krav\s?maga|capoeira|escrime)\b/i

const GYM_CHAIN_PRIORITY =
  /\b(basic[- ]?fit|fitness\s+park|orange\s+bleue|keep\s+cool|neoness|giga\s?fit|curves|world\s+gym)\b/i

/** Requêtes textSearch pour compléter nearbySearch (chaînes majeures). */
const FITNESS_TEXT_SEARCH_QUERIES = [
  'Basic-Fit',
  'Fitness Park',
  "L'Orange Bleue",
  'Keep Cool',
  'Neoness',
  'salle de sport fitness',
] as const

const GYM_NAME_PATTERN =
  /\b(fitness|musculation|muscu|gym|basic[- ]?fit|l'?orange\s?bleue|keep\s?cool|neoness|giga|curves|salles?\s+de\s+sport|salle\s+de\s+musculation|world\s+gym|fit\s?ness\s?park|crossfit|iron\s+gym|power\s+lift)\b/i

const COMBAT_ALLOWED_TYPES = new Set(['gym', 'fitness_center', 'martial_arts_school', 'stadium'])

const COMBAT_NAME_PATTERN =
  /\b(boxe|boxing|mma|kick\s?boxing|muay\s?thai|dojo|karat[ée]|judo|arts?\s?martiaux|grappling|bjj|jujitsu|club\s+de\s+combat)\b/i

const OUTDOOR_ALLOWED_TYPES = new Set([
  'stadium',
  'park',
  'gym',
  'fitness_center',
  'sports_complex',
  'athletic_field',
  'playground',
])

const OUTDOOR_NAME_PATTERN =
  /\b(stade|piste|terrain|gymnase|parc|velodrome|cyclable|running|football|athl[ée]tisme)\b/i

function placeTypes(place: GooglePlaceResult): string[] {
  return place.types ?? []
}

function placeName(place: GooglePlaceResult): string {
  return place.name ?? ''
}

function isDeniedRetailPlace(place: GooglePlaceResult): boolean {
  const types = placeTypes(place)
  const name = placeName(place)
  if (types.some((t) => RETAIL_DENIED_TYPES.has(t))) return true
  if (RETAIL_DENIED_NAME.test(name)) return true
  return false
}

function isAllowedFitnessGymPlace(place: GooglePlaceResult): boolean {
  if (isDeniedRetailPlace(place)) return false

  const types = placeTypes(place)
  const name = placeName(place)

  if (types.some((t) => MARTIAL_ARTS_DENIED_TYPES.has(t))) return false
  if (MARTIAL_ARTS_DENIED_NAME.test(name)) return false

  if (types.some((t) => GYM_ALLOWED_TYPES.has(t))) return true
  if (GYM_NAME_PATTERN.test(name)) return true

  return false
}

function isAllowedCombatPlace(place: GooglePlaceResult): boolean {
  if (isDeniedRetailPlace(place)) return false

  const types = placeTypes(place)
  const name = placeName(place)

  if (types.some((t) => COMBAT_ALLOWED_TYPES.has(t))) return true
  if (COMBAT_NAME_PATTERN.test(name)) return true

  return false
}

function isAllowedOutdoorSportPlace(place: GooglePlaceResult): boolean {
  if (isDeniedRetailPlace(place)) return false

  const types = placeTypes(place)
  const name = placeName(place)

  if (types.some((t) => OUTDOOR_ALLOWED_TYPES.has(t))) return true
  if (OUTDOOR_NAME_PATTERN.test(name)) return true

  return false
}

function isAllowedCrossfitPlace(place: GooglePlaceResult): boolean {
  if (isDeniedRetailPlace(place)) return false

  const name = placeName(place)
  if (/\b(crossfit|cross\s?fit)\b/i.test(name)) return true

  return isAllowedFitnessGymPlace(place)
}

function isPlaceAllowedForDiscipline(
  place: GooglePlaceResult,
  disciplineId: AppDisciplineId,
): boolean {
  switch (disciplineId) {
    case 'musculation':
    case 'fitness':
      return isAllowedFitnessGymPlace(place)
    case 'crossfit':
      return isAllowedCrossfitPlace(place)
    case 'combat':
      return isAllowedCombatPlace(place)
    case 'course':
    case 'football':
    case 'cyclisme':
      return isAllowedOutdoorSportPlace(place)
    default:
      return isAllowedFitnessGymPlace(place)
  }
}

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
          textSearch: (
            request: {
              query: string
              location?: { lat: number; lng: number }
              radius?: number
            },
            callback: (results: GooglePlaceResult[] | null, status: string) => void,
          ) => void
        }
      }
      Geocoder: new () => {
        geocode: (
          request: {
            address: string
            componentRestrictions?: { country: string }
            region?: string
          },
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
  textSearch: (
    request: {
      query: string
      location?: { lat: number; lng: number }
      radius?: number
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

function textSearchOnce(
  service: PlacesServiceInstance,
  request: {
    query: string
    location?: { lat: number; lng: number }
    radius?: number
  },
  okStatus: string,
  zeroStatus: string,
): Promise<GooglePlaceResult[]> {
  return new Promise((resolve, reject) => {
    service.textSearch(request, (results, status) => {
      if (status === okStatus) {
        resolve(results ?? [])
        return
      }
      if (status === zeroStatus) {
        resolve([])
        return
      }
      reject(new GooglePlacesError(`Places Text Search a échoué (${status}).`))
    })
  })
}

function isFitnessDiscipline(discId: AppDisciplineId): boolean {
  return discId === 'musculation' || discId === 'fitness' || discId === 'crossfit'
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
  const sortScore = (gym: NearbyGym) => {
    const chainBoost = GYM_CHAIN_PRIORITY.test(gym.name) ? 0 : 1_000_000
    return chainBoost + gym.distanceMeters
  }

  const byId = new Map<string, NearbyGym>()
  for (const gym of gyms.sort((a, b) => sortScore(a) - sortScore(b))) {
    if (!byId.has(gym.id)) byId.set(gym.id, gym)
  }
  return [...byId.values()].sort((a, b) => sortScore(a) - sortScore(b))
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

  const nearbyBatches = await Promise.all(
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

  let textBatches: GooglePlaceResult[][] = []
  if (isFitnessDiscipline(discId)) {
    textBatches = await Promise.all(
      FITNESS_TEXT_SEARCH_QUERIES.map((query) =>
        textSearchOnce(
          service,
          { query, location, radius: radiusMeters },
          OK,
          ZERO_RESULTS,
        ).catch(() => [] as GooglePlaceResult[]),
      ),
    )
  }

  const batches = [...nearbyBatches, ...textBatches]

  const mapped = batches
    .flat()
    .filter((place) => isPlaceAllowedForDiscipline(place, discId))
    .map((place) => placeResultToGym(place, safeUserLat, safeUserLng, allowAllCheckIn))
    .filter((gym): gym is NearbyGym => gym != null)
    .filter((gym) => gym.distanceMeters <= radiusMeters)
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
    geocoder.geocode(
      {
        address: cityQuery,
        componentRestrictions: { country: 'fr' },
        region: 'fr',
      },
      (results, status) => {
        if (status !== 'OK' || !results?.[0]?.geometry?.location) {
          reject(
            new GooglePlacesError(
              status === 'ZERO_RESULTS'
                ? `Aucun résultat pour « ${cityQuery} ».`
                : `Géocodage Google impossible (${status}).`,
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
          first.formatted_address?.split(',').slice(0, 2).join(',').trim() ?? `${cityQuery}, France`

        resolve({
          coords: { lat: coords.lat, lng: coords.lng },
          label,
        })
      },
    )
  })
}

interface NominatimResult {
  lat?: string
  lon?: string
  display_name?: string
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string
    city?: string
    state?: string
    country?: string
  }
}

/** Géocodeur gratuit compatible navigateur (CORS *). Prioritaire pour la recherche ville. */
async function geocodeCityWithPhoton(cityQuery: string): Promise<GeocodedPlace> {
  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', `${cityQuery}, France`)
  url.searchParams.set('limit', '1')
  url.searchParams.set('lang', 'fr')

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new GooglePlacesError(`Géocodage Photon indisponible (${response.status}).`)
  }

  const payload = (await response.json()) as { features?: PhotonFeature[] }
  const feature = payload.features?.[0]
  const coords = feature?.geometry?.coordinates
  const lat = coords?.[1]
  const lng = coords?.[0]

  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new GooglePlacesError(`Aucun résultat pour « ${cityQuery} ».`)
  }

  const props = feature?.properties ?? {}
  const label =
    [props.name, props.state ?? props.city, props.country].filter(Boolean).join(', ') ||
    `${cityQuery}, France`

  return { coords: { lat, lng }, label }
}

/** Fallback gratuit si Geocoding Google indisponible (API non activée, quota, etc.). */
async function geocodeCityWithNominatim(cityQuery: string): Promise<GeocodedPlace> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', `${cityQuery}, France`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'fr')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RankedGym/1.0 (https://ranked-gym.lembrezevan.workers.dev)',
    },
  })

  if (!response.ok) {
    throw new GooglePlacesError(`Géocodage Nominatim indisponible (${response.status}).`)
  }

  const results = (await response.json()) as NominatimResult[]
  const hit = results[0]
  const lat = hit?.lat != null ? Number.parseFloat(hit.lat) : Number.NaN
  const lng = hit?.lon != null ? Number.parseFloat(hit.lon) : Number.NaN

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new GooglePlacesError(`Aucun résultat pour « ${cityQuery} » (Nominatim).`)
  }

  const label =
    hit.display_name?.split(',').slice(0, 2).join(',').trim() ?? `${cityQuery}, France`

  return {
    coords: { lat, lng },
    label,
  }
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

  const attempts: Array<{ name: string; run: () => Promise<GeocodedPlace> }> = [
    { name: 'Photon', run: () => geocodeCityWithPhoton(query) },
  ]

  if (!isMockPlacesMode()) {
    attempts.push({ name: 'Google', run: () => geocodeCityWithGoogle(query) })
  }

  attempts.push({ name: 'Nominatim', run: () => geocodeCityWithNominatim(query) })

  let lastError: unknown = null
  for (const attempt of attempts) {
    try {
      return await attempt.run()
    } catch (error) {
      lastError = error
      safeWarn(`[geocodeCity] ${attempt.name} échoué`, error)
    }
  }

  if (isMockPlacesMode()) {
    await delay(450)
    const normalized = query.toLowerCase()
    const known = Object.entries(MOCK_CITY_COORDS).find(([key]) => normalized.includes(key))
    if (known) return known[1]
  }

  if (lastError instanceof GooglePlacesError) throw lastError
  throw new GooglePlacesError(
    lastError instanceof Error
      ? lastError.message
      : `Impossible de localiser « ${query} ». Vérifie l’orthographe.`,
  )
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
