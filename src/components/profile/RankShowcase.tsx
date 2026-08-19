import { Shield, Sparkles } from 'lucide-react'
import type { RankInfo } from '../../utils/rank'
import { rankVisuals } from '../../utils/rank'

interface RankShowcaseProps {
  rank: RankInfo
  level: number
}

export function RankShowcase({ rank, level }: RankShowcaseProps) {
  const visual = rankVisuals[rank.tier]

  return (
    <section className="relative">
      <div
        className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br p-[1px] ${visual.border} ${visual.glow}`}
      >
        <div className={`rounded-3xl bg-gradient-to-br ${visual.gradient} p-6`}>
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${visual.shimmer} opacity-60`}
            aria-hidden="true"
          />

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-3 flex items-center gap-2">
              <Shield className={`h-4 w-4 ${visual.accent}`} />
              <span className={`text-xs font-bold uppercase tracking-[0.25em] ${visual.accent}`}>
                Muscu Classée
              </span>
              <Shield className={`h-4 w-4 ${visual.accent}`} />
            </div>

            <div className="relative mb-2">
              <Sparkles className={`absolute -left-6 top-1/2 h-4 w-4 -translate-y-1/2 ${visual.accent} opacity-70`} />
              <Sparkles className={`absolute -right-6 top-1/2 h-4 w-4 -translate-y-1/2 ${visual.accent} opacity-70`} />
              <h2
                className={`text-4xl font-black tracking-wider drop-shadow-lg sm:text-5xl ${visual.text}`}
                style={{ textShadow: '0 0 30px currentColor' }}
              >
                {rank.label}
              </h2>
            </div>

            <p className={`text-sm font-semibold uppercase tracking-widest ${visual.accent}`}>
              {rank.tier}
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-1.5 backdrop-blur-sm">
              <span className="text-xs text-white/60">Level</span>
              <span className={`text-lg font-black ${visual.text}`}>{level}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
