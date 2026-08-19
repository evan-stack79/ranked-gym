import type { RankInfo } from '../../utils/rank'
import { rankVisuals } from '../../utils/rankVisuals'

interface RankShowcaseProps {
  rank: RankInfo
  level: number
}

function CardWatermark() {
  return (
    <svg
      className="pointer-events-none absolute -right-4 -top-2 h-40 w-40 opacity-[0.07]"
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="52" fill="none" stroke="white" strokeWidth="1" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="white" strokeWidth="1" />
      <circle cx="60" cy="60" r="20" fill="none" stroke="white" strokeWidth="1" />
      <path d="M20 60 H100 M60 20 V100" stroke="white" strokeWidth="0.75" />
    </svg>
  )
}

export function RankShowcase({ rank, level }: RankShowcaseProps) {
  const visual = rankVisuals[rank.tier]

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${visual.gradient} p-6`}
      style={{ boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08)' }}
      aria-label={`Rang ${rank.label}`}
    >
      <CardWatermark />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="rank-shine absolute -left-1/2 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative">
        <p className={`text-[13px] font-medium ${visual.sublabel}`}>Muscu Classée</p>

        <h2 className={`mt-3 text-[34px] font-bold tracking-tight ${visual.label}`}>
          {rank.label}
        </h2>

        <p className={`mt-1 text-[15px] font-medium ${visual.sublabel}`}>{rank.tier}</p>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className={`text-[13px] ${visual.sublabel}`}>Niveau</p>
            <p className={`text-[22px] font-semibold tracking-tight ${visual.label}`}>{level}</p>
          </div>
          <p className={`text-right text-[13px] ${visual.sublabel}`}>
            Division {rank.division}
          </p>
        </div>
      </div>
    </section>
  )
}
