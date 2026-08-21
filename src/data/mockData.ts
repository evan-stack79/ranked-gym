import type { GymMember, RankTier } from '../types'
import { APP_DISCIPLINES, getStoredDisciplineId } from './disciplines'

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

const NAME_POOL = [
  'TitanForge',
  'FlexQueen',
  'IronVortex',
  'NovaShred',
  'BeastMode_X',
  'GoldRush_22',
  'AlphaGrind',
  'PaceQueen',
  'MidfieldAce',
  'RoundHouse',
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
  const ranks: RankTier[] = ['Or', 'Platine', 'Diamant', 'Légende', 'Argent']

  return Array.from({ length: memberCount }, (_, index) => {
    const disc = APP_DISCIPLINES[(seed + index) % APP_DISCIPLINES.length]
    const activity =
      disc.lobbyActivities[(seed + index * 3) % disc.lobbyActivities.length]
    return {
      id: `${gymId}-member-${index}`,
      username: NAME_POOL[(seed + index) % NAME_POOL.length],
      avatarUrl: '',
      level: 25 + ((seed + index * 7) % 50),
      rank: ranks[(seed + index) % ranks.length],
      currentExercise: activity,
      disciplineLabel: disc.label,
    }
  })
}

/** Prefer current user's discipline first in lobby flavor text. */
export function generateLobbyMembersForDiscipline(
  gymId: string,
  count = 4,
  disciplineId = getStoredDisciplineId(),
): GymMember[] {
  const base = generateLobbyMembers(gymId, count)
  if (!base.length) return base
  const disc = APP_DISCIPLINES.find((d) => d.id === disciplineId) ?? APP_DISCIPLINES[0]
  return base.map((m, i) =>
    i === 0
      ? {
          ...m,
          disciplineLabel: disc.label,
          currentExercise: disc.lobbyActivities[hashString(gymId) % disc.lobbyActivities.length],
        }
      : m,
  )
}
