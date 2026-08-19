import type { GymMember, RankTier } from '../types'

export const currentUser = {
  id: 'user-1',
  username: 'Evan_Lift',
  avatarUrl: '',
  level: 42,
  rank: 'Platine' as RankTier,
  currentXp: 850,
  xpToNextLevel: 1000,
}

export const rankColors: Record<RankTier, { text: string; bg: string; border: string }> = {
  Bronze: { text: 'text-[#D4A574]', bg: 'bg-[#3D2E24]/60', border: 'border-transparent' },
  Argent: { text: 'text-[#E5E5EA]', bg: 'bg-[#48484A]/60', border: 'border-transparent' },
  Or: { text: 'text-[#F2D98B]', bg: 'bg-[#3D3520]/60', border: 'border-transparent' },
  Platine: { text: 'text-[#B8D4E8]', bg: 'bg-[#1E2A38]/60', border: 'border-transparent' },
  Diamant: { text: 'text-[#C8E6F5]', bg: 'bg-[#1A2838]/60', border: 'border-transparent' },
  Master: { text: 'text-[#D4B8E8]', bg: 'bg-[#2A1A38]/60', border: 'border-transparent' },
  Légende: { text: 'text-[#B8E8C8]', bg: 'bg-[#1A2E24]/60', border: 'border-transparent' },
}

const LOBBY_POOL: Omit<GymMember, 'id'>[] = [
  { username: 'TitanForge', avatarUrl: '', level: 67, rank: 'Légende', currentExercise: 'Développé couché 140 kg' },
  { username: 'FlexQueen', avatarUrl: '', level: 58, rank: 'Diamant', currentExercise: 'Curl à la barre EZ' },
  { username: 'IronVortex', avatarUrl: '', level: 54, rank: 'Platine', currentExercise: 'Squat barre 5×5' },
  { username: 'NovaShred', avatarUrl: '', level: 61, rank: 'Diamant', currentExercise: 'Tractions lestées' },
  { username: 'BeastMode_X', avatarUrl: '', level: 49, rank: 'Platine', currentExercise: 'Soulevé de terre' },
  { username: 'AlphaGrind', avatarUrl: '', level: 72, rank: 'Légende', currentExercise: 'Presse à cuisses' },
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function generateLobbyMembers(gymId: string, count = 4): GymMember[] {
  const seed = hashString(gymId)
  const memberCount = count > 0 ? count : 3 + (seed % 2)
  const shuffled = [...LOBBY_POOL].sort((a, b) => {
    const scoreA = hashString(gymId + a.username)
    const scoreB = hashString(gymId + b.username)
    return scoreA - scoreB
  })

  return shuffled.slice(0, memberCount).map((member, index) => ({
    ...member,
    id: `${gymId}-member-${index}`,
  }))
}
