import type { NearbyGym } from '../types'

export type LobbyGymSortMode = 'recommended' | 'nearest' | 'rating'

export const LOBBY_GYM_SORT_OPTIONS: Array<{
  id: LobbyGymSortMode
  label: string
  emoji: string
}> = [
  { id: 'recommended', label: 'Recommandé', emoji: '🔥' },
  { id: 'nearest', label: 'Plus proche', emoji: '📍' },
  { id: 'rating', label: 'Mieux noté', emoji: '⭐' },
]

/** Score composite : note élevée + distance raisonnable (défaut). */
export function recommendedGymScore(gym: NearbyGym): number {
  const rating = gym.rating != null && Number.isFinite(gym.rating) ? gym.rating : 3
  const distanceKm = gym.distanceMeters / 1000
  // Ex. 2 km · 4.5★ (12.6) > 1 km · 3.5★ (10.05)
  return rating * 3 - Math.min(distanceKm * 0.45, 2)
}

export function sortLobbyGyms(gyms: NearbyGym[], mode: LobbyGymSortMode): NearbyGym[] {
  const copy = [...gyms]

  switch (mode) {
    case 'nearest':
      return copy.sort((a, b) => a.distanceMeters - b.distanceMeters)
    case 'rating':
      return copy.sort((a, b) => {
        const ratingA = a.rating ?? -1
        const ratingB = b.rating ?? -1
        if (ratingB !== ratingA) return ratingB - ratingA
        return a.distanceMeters - b.distanceMeters
      })
    case 'recommended':
    default:
      return copy.sort((a, b) => {
        const scoreDiff = recommendedGymScore(b) - recommendedGymScore(a)
        if (scoreDiff !== 0) return scoreDiff
        return a.distanceMeters - b.distanceMeters
      })
  }
}
