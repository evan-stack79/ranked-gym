import type { GymMember, RankTier, UserProfile } from '../types'

export const currentUser: UserProfile = {
  id: 'user-1',
  username: 'Evan_Lift',
  avatarUrl: '',
  level: 42,
  rank: 'Platine',
  currentXp: 7250,
  xpToNextLevel: 10000,
}

export const gymMembersPresent: GymMember[] = [
  {
    id: 'member-1',
    username: 'IronMike',
    avatarUrl: '',
    level: 38,
    rank: 'Or',
    currentExercise: 'Développé couché',
  },
  {
    id: 'member-2',
    username: 'FlexQueen',
    avatarUrl: '',
    level: 51,
    rank: 'Diamant',
    currentExercise: 'Curl à la barre EZ',
  },
  {
    id: 'member-3',
    username: 'BeastMode_99',
    avatarUrl: '',
    level: 29,
    rank: 'Argent',
    currentExercise: 'Squat barre',
  },
  {
    id: 'member-4',
    username: 'NovaShred',
    avatarUrl: '',
    level: 45,
    rank: 'Platine',
    currentExercise: 'Tractions lestées',
  },
]

export const rankColors: Record<RankTier, { text: string; bg: string; border: string }> = {
  Bronze: { text: 'text-amber-600', bg: 'bg-amber-600/20', border: 'border-amber-600/40' },
  Argent: { text: 'text-slate-300', bg: 'bg-slate-400/20', border: 'border-slate-400/40' },
  Or: { text: 'text-yellow-400', bg: 'bg-yellow-400/20', border: 'border-yellow-400/40' },
  Platine: { text: 'text-neon-blue', bg: 'bg-neon-blue/20', border: 'border-neon-blue/40' },
  Diamant: { text: 'text-cyan-300', bg: 'bg-cyan-400/20', border: 'border-cyan-400/40' },
  Légende: { text: 'text-neon-green', bg: 'bg-neon-green/20', border: 'border-neon-green/40' },
}

export const simulatedGymLocation = {
  name: 'Iron Arena Fitness',
  address: '12 Rue de la Force, Paris',
  lat: 48.8566,
  lng: 2.3522,
}
