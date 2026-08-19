import { Zap, TrendingUp } from 'lucide-react'

interface ProfileXPBarProps {
  level: number
  currentXp: number
  xpToNextLevel: number
}

export function ProfileXPBar({ level, currentXp, xpToNextLevel }: ProfileXPBarProps) {
  const progress = Math.min((currentXp / xpToNextLevel) * 100, 100)
  const remaining = xpToNextLevel - currentXp

  return (
    <section className="rounded-2xl border border-white/5 bg-anthracite-light p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neon-green/15">
            <TrendingUp className="h-5 w-5 text-neon-green" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Progression
            </p>
            <p className="text-lg font-black text-white">
              Level <span className="text-neon-green">{level}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">XP</p>
          <p className="font-bold text-neon-blue">
            {currentXp.toLocaleString('fr-FR')}
            <span className="text-slate-500"> / </span>
            {xpToNextLevel.toLocaleString('fr-FR')}
          </p>
        </div>
      </div>

      <div className="relative h-4 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-green via-emerald-400 to-neon-blue transition-all duration-700"
          style={{
            width: `${progress}%`,
            boxShadow: '0 0 20px rgba(0,255,136,0.5)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-500">
          <Zap className="h-3 w-3 text-neon-green" />
          {remaining.toLocaleString('fr-FR')} XP avant Level {level + 1}
        </span>
        <span className="font-semibold text-neon-green">{Math.round(progress)}%</span>
      </div>
    </section>
  )
}
