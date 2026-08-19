import type { GymMember, RankTier } from '../types'

export const currentUser = {
  id: 'user-1',
  username: 'Evan_Lift',
  avatarUrl: '',
  level: 42,
  rank: 'Platine' as RankTier,
  currentXp: 7250,
  xpToNextLevel: 10000,
}

export const rankColors: Record<RankTier, { text: string; bg: string; border: string }> = {
  Bronze: { text: 'text-amber-600', bg: 'bg-amber-600/20', border: 'border-amber-600/40' },
  Argent: { text: 'text-slate-300', bg: 'bg-slate-400/20', border: 'border-slate-400/40' },
  Or: { text: 'text-yellow-400', bg: 'bg-yellow-400/20', border: 'border-yellow-400/40' },
  Platine: { text: 'text-neon-blue', bg: 'bg-neon-blue/20', border: 'border-neon-blue/40' },
  Diamant: { text: 'text-cyan-300', bg: 'bg-cyan-400/20', border: 'border-cyan-400/40' },
  Légende: { text: 'text-neon-green', bg: 'bg-neon-green/20', border: 'border-neon-green/40' },
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
