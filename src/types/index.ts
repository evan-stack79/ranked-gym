export type RankTier = 'Bronze' | 'Argent' | 'Or' | 'Platine' | 'Diamant' | 'Légende'

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
}

export interface NearbyGym {
  id: string
  name: string
  lat: number
  lng: number
  address?: string
  distanceMeters: number
  canCheckIn: boolean
}

export interface GeoCoordinates {
  lat: number
  lng: number
  accuracy?: number
}

export type TabId = 'home' | 'lobby' | 'training' | 'profile'

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
