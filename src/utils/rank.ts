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
