import type { RankTier } from '../types'

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
