export type RankTier = 'Bronze' | 'Argent' | 'Or' | 'Platine' | 'Diamant' | 'Master' | 'Légende'

export interface UserProfile {
  id: string
  username: string
  avatarUrl: string
  level: number
  rank: RankTier
  currentXp: number
  xpToNextLevel: number
}

export interface GymMember {
  id: string
  username: string
  avatarUrl: string
  level: number
  rank: RankTier
  currentExercise: string
  /** Athlete's sport for the day */
  disciplineLabel?: string
}

export interface NearbyGym {
  id: string
  name: string
  lat: number
  lng: number
  address?: string
  distanceMeters: number
  canCheckIn: boolean
  isCustom?: boolean
  /** Google Places rating out of 5 */
  rating?: number
  userRatingsTotal?: number
  /** Spot category for multi-sport lobby */
  spotKind?: string
}

export interface GeoCoordinates {
  lat: number
  lng: number
  accuracy?: number
}

/** Navigation principale V1 : Lobby retiré du BottomNav (infra Lobby conservée). */
export type TabId = 'home' | 'training' | 'nutrition' | 'profile'

export interface NavTab {
  id: TabId
  label: string
}

export type LobbyPhase = 'idle' | 'locating' | 'geocoding' | 'fetching' | 'ready' | 'checked-in'

export type LocationSource = 'gps' | 'manual'

export interface LocationContext {
  coords: GeoCoordinates
  source: LocationSource
  label: string
}
