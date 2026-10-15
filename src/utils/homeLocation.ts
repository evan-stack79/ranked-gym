/**
 * Home area helpers for the retired Lobby location stack.
 * Always degrade gracefully — no GPS / check-in storage is read anymore.
 */

export interface HomeAreaCoords {
  lat: number
  lng: number
}

/** Ville connue immédiatement. Always null after Lobby location retirement. */
export function resolveHomeAreaNameSync(): string | null {
  return null
}

/** Coordonnées pour reverse geocoding. Always null after Lobby location retirement. */
export function resolveHomeAreaCoords(): HomeAreaCoords | null {
  return null
}

/** Ville via reverse geocoding si nécessaire. Null = afficher « autour de vous ». */
export async function resolveHomeAreaNameAsync(): Promise<string | null> {
  return null
}
