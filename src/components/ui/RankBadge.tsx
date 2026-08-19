import { Trophy } from 'lucide-react'
import type { RankTier } from '../../types'
import { rankColors } from '../../data/mockData'

interface RankBadgeProps {
  rank: RankTier
  level: number
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
  lg: 'px-4 py-1.5 text-base gap-2',
}

export function RankBadge({ rank, level, size = 'md' }: RankBadgeProps) {
  const colors = rankColors[rank]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full border font-semibold ${colors.text} ${colors.bg} ${colors.border} ${sizeStyles[size]}`}
      >
        <Trophy className="h-3.5 w-3.5" />
        {rank}
      </span>
      <span className="text-sm font-medium text-slate-400">
        Niveau <span className="neon-text-green font-bold text-neon-green">{level}</span>
      </span>
    </div>
  )
}
