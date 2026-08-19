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
  md: 'px-2.5 py-1 text-xs gap-1',
  lg: 'px-3 py-1 text-sm gap-1.5',
}

export function RankBadge({ rank, level, size = 'md' }: RankBadgeProps) {
  const colors = rankColors[rank]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full font-medium ${colors.text} ${colors.bg} ${sizeStyles[size]}`}
      >
        <Trophy className="h-3 w-3" />
        {rank}
      </span>
      <span className="text-sm text-[#8E8E93]">
        Niveau <span className="font-semibold text-white">{level}</span>
      </span>
    </div>
  )
}
