interface ProfileXPBarProps {
  level: number
  currentXp: number
  xpToNextLevel: number
}

export function ProfileXPBar({ level, currentXp, xpToNextLevel }: ProfileXPBarProps) {
  const progress = Math.min((currentXp / xpToNextLevel) * 100, 100)
  const remaining = xpToNextLevel - currentXp

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="ios-label">Expérience</p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight text-white">
            Niveau {level}
          </p>
        </div>
        <p className="text-[15px] font-medium text-[#FF9F0A]">
          {currentXp} / {xpToNextLevel} XP
        </p>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/40">
        <div
          className="h-full rounded-full xp-fill transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-3 text-[13px] text-[#8E8E93]">
        {remaining} XP avant le niveau {level + 1}
      </p>
    </section>
  )
}
