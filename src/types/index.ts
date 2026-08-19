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

export type TabId = 'home' | 'lobby' | 'training' | 'profile'

export interface NavTab {
  id: TabId
  label: string
}
