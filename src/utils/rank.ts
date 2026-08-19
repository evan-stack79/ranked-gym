import type { RankTier } from '../types'

export type RankDivision = 'I' | 'II' | 'III'

export interface RankInfo {
  tier: RankTier
  division: RankDivision
  label: string
  title: string
}

const TIER_TITLES: Record<RankTier, string> = {
  Bronze: 'Recrue de la Fonte',
  Argent: 'Soldat du Squat',
  Or: 'Champion du Rack',
  Platine: 'Guerrier de la Fonte',
  Diamant: 'Élite de l\'Acier',
  Master: 'Maître du Fer',
  Légende: 'Légende Vivante',
}

const TIER_RANGES: Record<RankTier, { min: number; max: number }> = {
  Bronze: { min: 1, max: 10 },
  Argent: { min: 11, max: 20 },
  Or: { min: 21, max: 30 },
  Platine: { min: 31, max: 45 },
  Diamant: { min: 46, max: 60 },
  Master: { min: 61, max: 75 },
  Légende: { min: 76, max: 999 },
}

function getTier(level: number): RankTier {
  if (level >= TIER_RANGES.Légende.min) return 'Légende'
  if (level >= TIER_RANGES.Master.min) return 'Master'
  if (level >= TIER_RANGES.Diamant.min) return 'Diamant'
  if (level >= TIER_RANGES.Platine.min) return 'Platine'
  if (level >= TIER_RANGES.Or.min) return 'Or'
  if (level >= TIER_RANGES.Argent.min) return 'Argent'
  return 'Bronze'
}

function getDivision(level: number, tier: RankTier): RankDivision {
  if (tier === 'Légende') return 'I'

  const { min, max } = TIER_RANGES[tier]
  const span = max - min + 1
  const position = level - min
  const segment = span / 3

  if (position >= segment * 2) return 'III'
  if (position >= segment) return 'II'
  return 'I'
}

export function getRankFromLevel(level: number): RankInfo {
  const safeLevel = Math.max(1, level)
  const tier = getTier(safeLevel)
  const division = getDivision(safeLevel, tier)
  const label = tier === 'Légende' ? 'LÉGENDE' : `${tier.toUpperCase()} ${division}`

  return {
    tier,
    division,
    label,
    title: TIER_TITLES[tier],
  }
}

export interface RankVisual {
  gradient: string
  border: string
  glow: string
  text: string
  accent: string
  shimmer: string
}

export const rankVisuals: Record<RankTier, RankVisual> = {
  Bronze: {
    gradient: 'from-amber-900/80 via-amber-700/60 to-orange-900/80',
    border: 'border-amber-500/50',
    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.35)]',
    text: 'text-amber-300',
    accent: 'text-amber-400',
    shimmer: 'from-amber-400/20 via-orange-300/10 to-amber-400/20',
  },
  Argent: {
    gradient: 'from-slate-700/80 via-slate-400/40 to-slate-800/80',
    border: 'border-slate-300/40',
    glow: 'shadow-[0_0_40px_rgba(203,213,225,0.25)]',
    text: 'text-slate-200',
    accent: 'text-slate-300',
    shimmer: 'from-slate-300/20 via-white/10 to-slate-300/20',
  },
  Or: {
    gradient: 'from-yellow-700/80 via-yellow-400/50 to-amber-600/80',
    border: 'border-yellow-400/50',
    glow: 'shadow-[0_0_45px_rgba(250,204,21,0.4)]',
    text: 'text-yellow-200',
    accent: 'text-yellow-400',
    shimmer: 'from-yellow-300/25 via-amber-200/15 to-yellow-300/25',
  },
  Platine: {
    gradient: 'from-cyan-900/90 via-neon-blue/40 to-blue-900/90',
    border: 'border-neon-blue/60',
    glow: 'shadow-[0_0_50px_rgba(0,212,255,0.45)]',
    text: 'text-cyan-100',
    accent: 'text-neon-blue',
    shimmer: 'from-neon-blue/30 via-cyan-200/20 to-neon-blue/30',
  },
  Diamant: {
    gradient: 'from-violet-900/90 via-cyan-400/30 to-indigo-900/90',
    border: 'border-cyan-300/50',
    glow: 'shadow-[0_0_55px_rgba(34,211,238,0.5)]',
    text: 'text-cyan-50',
    accent: 'text-cyan-300',
    shimmer: 'from-cyan-300/30 via-white/20 to-violet-300/30',
  },
  Master: {
    gradient: 'from-purple-950/90 via-fuchsia-600/40 to-red-950/90',
    border: 'border-fuchsia-400/50',
    glow: 'shadow-[0_0_55px_rgba(192,38,211,0.45)]',
    text: 'text-fuchsia-100',
    accent: 'text-fuchsia-400',
    shimmer: 'from-fuchsia-400/30 via-pink-300/15 to-purple-400/30',
  },
  Légende: {
    gradient: 'from-emerald-950/90 via-neon-green/35 to-yellow-900/80',
    border: 'border-neon-green/60',
    glow: 'shadow-[0_0_60px_rgba(0,255,136,0.5)]',
    text: 'text-neon-green',
    accent: 'text-yellow-300',
    shimmer: 'from-neon-green/35 via-yellow-300/20 to-neon-green/35',
  },
}
