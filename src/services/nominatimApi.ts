import type { GeoCoordinates } from '../types'

export class NominatimError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NominatimError'
  }
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export interface GeocodedPlace {
  coords: GeoCoordinates
  label: string
}

export async function geocodeCity(cityQuery: string): Promise<GeocodedPlace> {
  const query = cityQuery.trim()
  if (query.length < 2) {
    throw new NominatimError('Entre au moins 2 caractères pour rechercher une ville.')
  }

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  })

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fr',
      },
    },
  )

  if (!response.ok) {
    throw new NominatimError('Le service de géocodage est indisponible. Réessaie dans un instant.')
  }

  const results = (await response.json()) as NominatimResult[]
  const place = results[0]

  if (!place) {
    throw new NominatimError(`Aucun résultat pour « ${query} ». Essaie une autre orthographe.`)
  }

  const lat = Number.parseFloat(place.lat)
  const lng = Number.parseFloat(place.lon)

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new NominatimError('Coordonnées invalides reçues du géocodage.')
  }

  const label = place.display_name.split(',').slice(0, 2).join(',').trim()

  return {
    coords: { lat, lng },
    label,
  }
}
