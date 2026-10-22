import { Zap } from 'lucide-react'
import { LivingProgressBar } from '../motion/LivingProgressBar'

interface XPProgressBarProps {
  currentXp: number
  xpToNextLevel: number
  level: number
}

export function XPProgressBar({ currentXp, xpToNextLevel, level }: XPProgressBarProps) {
  const progress = Math.min(currentXp / Math.max(1, xpToNextLevel), 1)
  const remaining = Math.max(0, xpToNextLevel - currentXp)

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-[#8E8E93]">
          <Zap className="h-4 w-4 text-[#FF2B2B]" />
          Progression XP
        </span>
        <span className="text-[#FF2B2B]">
          {currentXp.toLocaleString('fr-FR')} / {xpToNextLevel.toLocaleString('fr-FR')} XP
        </span>
      </div>

      <LivingProgressBar
        value={progress}
        sparksAtFull
        aria-label="Progression XP"
        fillClassName="xp-fill"
      />

      <p className="mt-2 text-xs text-[#8E8E93]">
        {remaining.toLocaleString('fr-FR')} XP restants pour le niveau {level + 1}
      </p>
    </div>
  )
}
