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
          <Zap className="h-4 w-4" />
          Progression XP
        </span>
        <span className="text-[#8E8E93]">
          {currentXp.toLocaleString('fr-FR')} / {xpToNextLevel.toLocaleString('fr-FR')} XP
        </span>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full bg-[#2C2C2E]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#0A84FF] transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-[#8E8E93]">
        {remaining.toLocaleString('fr-FR')} XP restants pour le niveau {level + 1}
      </p>
    </div>
  )
}
