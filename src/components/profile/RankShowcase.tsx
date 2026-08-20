import type { RankInfo } from '../../utils/rank'
import { rankVisuals } from '../../utils/rankVisuals'

interface RankShowcaseProps {
  rank: RankInfo
  level: number
}

function CardWatermark({ dark }: { dark: boolean }) {
  const stroke = dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.14)'
  return (
    <svg
      className="pointer-events-none absolute -right-4 -top-2 h-44 w-44"
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="52" fill="none" stroke={stroke} strokeWidth="1.25" />
      <circle cx="60" cy="60" r="36" fill="none" stroke={stroke} strokeWidth="1.25" />
      <circle cx="60" cy="60" r="20" fill="none" stroke={stroke} strokeWidth="1.25" />
      <path d="M20 60 H100 M60 20 V100" stroke={stroke} strokeWidth="1" />
    </svg>
  )
}

export function RankShowcase({ rank, level }: RankShowcaseProps) {
  const visual = rankVisuals[rank.tier]
  const isGoldFace = rank.tier === 'Or'
  const isLegend = rank.tier === 'Légende'

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border-2 p-6 ${visual.border}`}
      style={{
        background: visual.background,
        boxShadow: `${visual.glow}, inset 0 1px 0 rgb(255 255 255 / 0.25)`,
      }}
      aria-label={`Rang ${rank.label}`}
    >
      <CardWatermark dark={isGoldFace} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="rank-shine absolute -left-1/2 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>

      {isLegend && (
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ boxShadow: 'inset 0 0 0 1px #FFD700' }}
          aria-hidden="true"
        />
      )}

      <div className="relative">
        <p className={`text-[13px] font-semibold uppercase tracking-wider ${visual.sublabel}`}>
          Muscu Classée
        </p>

        <h2 className={`mt-3 text-[34px] font-black tracking-tight ${visual.label}`}>
          {rank.label}
        </h2>

        <p className={`mt-1 text-[15px] font-semibold ${visual.sublabel}`}>{rank.tier}</p>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className={`text-[13px] font-medium ${visual.sublabel}`}>Niveau</p>
            <p className={`text-[26px] font-black tracking-tight ${visual.label}`}>{level}</p>
          </div>
          <p className={`text-right text-[13px] font-semibold ${visual.sublabel}`}>
            Division {rank.division}
          </p>
        </div>
      </div>
    </section>
  )
}
