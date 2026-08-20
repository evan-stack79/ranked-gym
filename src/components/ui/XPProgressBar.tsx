import { Zap } from 'lucide-react'

interface XPProgressBarProps {
  currentXp: number
  xpToNextLevel: number
  level: number
}

export function XPProgressBar({ currentXp, xpToNextLevel, level }: XPProgressBarProps) {
  const progress = Math.min((currentXp / xpToNextLevel) * 100, 100)
  const remaining = xpToNextLevel - currentXp

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-[#8E8E93]">
          <Zap className="h-4 w-4 text-[#FF9F0A]" />
          Progression XP
        </span>
        <span className="text-[#FF9F0A]">
          {currentXp.toLocaleString('fr-FR')} / {xpToNextLevel.toLocaleString('fr-FR')} XP
        </span>
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/40">
        <div
          className="absolute inset-y-0 left-0 rounded-full xp-fill transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-[#8E8E93]">
        {remaining.toLocaleString('fr-FR')} XP restants pour le niveau {level + 1}
      </p>
    </div>
  )
}
