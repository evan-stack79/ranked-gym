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
  Bronze: { text: 'text-[#FF9F5A]', bg: 'bg-[#C45A1A]/25', border: 'border-[#FF9F5A]/30' },
  Argent: { text: 'text-[#C8E0F0]', bg: 'bg-[#6B8FA8]/25', border: 'border-white/20' },
  Or: { text: 'text-[#FFD60A]', bg: 'bg-[#FFC107]/20', border: 'border-[#FFD60A]/35' },
  Platine: { text: 'text-[#5CFFE8]', bg: 'bg-[#00D4AA]/20', border: 'border-[#5CFFE8]/30' },
  Diamant: { text: 'text-[#FF4DCF]', bg: 'bg-[#C026FF]/20', border: 'border-[#FF4DCF]/35' },
  Master: { text: 'text-[#C4B5FD]', bg: 'bg-[#7C3AED]/25', border: 'border-[#A78BFA]/35' },
  Légende: { text: 'text-[#FFD700]', bg: 'bg-[#FF2B2B]/25', border: 'border-[#FFD700]/40' },
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
