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
        <span className="flex items-center gap-1.5 font-medium text-slate-300">
          <Zap className="h-4 w-4 text-neon-green" />
          Progression XP
        </span>
        <span className="text-slate-400">
          {currentXp.toLocaleString('fr-FR')} / {xpToNextLevel.toLocaleString('fr-FR')} XP
        </span>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-anthracite-light ring-1 ring-white/5">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-green to-neon-blue transition-all duration-700 ease-out neon-glow-green"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {remaining.toLocaleString('fr-FR')} XP restants pour le niveau {level + 1}
      </p>
    </div>
  )
}
