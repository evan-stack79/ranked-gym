import {
  decidePresenceOnPhone,
  PRESENCE_MAX_ACCURACY_M,
  PRESENCE_RADIUS_M,
} from '../../../convex/gymLeaderboardLogic'

export { PRESENCE_RADIUS_M, PRESENCE_MAX_ACCURACY_M, decidePresenceOnPhone }

export type GeolocationReading = {
  lat: number
  lng: number
  accuracyM: number
}

export async function readCurrentPosition(
  geolocation: Geolocation | undefined = typeof navigator !== 'undefined'
    ? navigator.geolocation
    : undefined,
): Promise<
  | { ok: true; reading: GeolocationReading }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' }
> {
  if (!geolocation?.getCurrentPosition) {
    return { ok: false, reason: 'unsupported' }
  }
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          reading: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
          },
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) resolve({ ok: false, reason: 'denied' })
        else resolve({ ok: false, reason: 'unavailable' })
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  })
}

/**
 * Compare phone position to gym point. Never send coordinates to the server —
 * only return the yes/no (or imprecise) decision.
 */
export function compareToGymPoint(
  reading: GeolocationReading,
  gym: { lat: number; lng: number },
): 'at_gym' | 'not_at_gym' | 'imprecise' {
  return decidePresenceOnPhone({
    userLat: reading.lat,
    userLng: reading.lng,
    accuracyM: reading.accuracyM,
    gymLat: gym.lat,
    gymLng: gym.lng,
  })
}
