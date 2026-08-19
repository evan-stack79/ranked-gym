import type { GeoCoordinates } from '../types'

export class GeolocationError extends Error {
  readonly code: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown'

  constructor(
    message: string,
    code: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown',
  ) {
    super(message)
    this.name = 'GeolocationError'
    this.code = code
  }
}

export function getCurrentPosition(options?: PositionOptions): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationError('La géolocalisation n\'est pas supportée par ce navigateur.', 'unsupported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        const codeMap: Record<number, GeolocationError['code']> = {
          [error.PERMISSION_DENIED]: 'denied',
          [error.POSITION_UNAVAILABLE]: 'unavailable',
          [error.TIMEOUT]: 'timeout',
        }
        const code = codeMap[error.code] ?? 'unknown'
        const messages: Record<GeolocationError['code'], string> = {
          unsupported: 'Géolocalisation non supportée.',
          denied: 'Autorise l\'accès à ta position pour trouver les salles à proximité.',
          unavailable: 'Position indisponible. Réessaie en extérieur ou avec le GPS activé.',
          timeout: 'Délai dépassé. Réessaie dans quelques secondes.',
          unknown: 'Impossible de récupérer ta position.',
        }
        reject(new GeolocationError(messages[code], code))
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
        ...options,
      },
    )
  })
}
